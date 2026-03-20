import crypto from 'crypto';
import type { EpodProcessResult, ProcessedItem, ProcessedOcrPatch } from '../../src/lib/epodApi.js';

export interface EpodWorkflowState extends EpodProcessResult {
  batchId: string;
}

const workflowStore = new Map<string, EpodWorkflowState>();
const submissionJobStore = new Map<string, EpodSubmissionJobState>();

const SUBMISSION_PROGRESS_STEP_MS = 700;

type SubmissionJobStatus = 'in_progress' | 'success' | 'failed' | 'cancelled';
type SubmissionRowStatus = 'Submitted' | 'Failed';
type FinalMatchStatus = 'matched' | 'manually_matched' | 'skipped';

export interface EpodSubmissionJobItem {
  id: string;
  workflowItemId: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fileName: string;
  vehicleInfo: string | null;
  finalMatchStatus: FinalMatchStatus;
  status: SubmissionRowStatus;
  failureReason: string | null;
  deliveryReviewStatus: 'clean' | 'unclean' | null;
}

export interface EpodSubmissionJob {
  jobId: string;
  batchId: string;
  source: string | null;
  createdBy: string | null;
  status: SubmissionJobStatus;
  totalFiles: number;
  processedCount: number;
  submittedCount: number;
  failedCount: number;
  pendingCount: number;
  attempt: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  items: EpodSubmissionJobItem[];
}

interface EpodSubmissionJobState extends Omit<EpodSubmissionJob, 'items' | 'processedCount' | 'submittedCount' | 'failedCount' | 'pendingCount'> {
  allItems: EpodSubmissionJobItem[];
  visibleCount: number;
  baselineVisibleCount: number;
  sourceItemIds: string[];
}

function recomputeSummary(items: ProcessedItem[]) {
  return {
    totalAwbs: new Set(items.filter((item) => !!item.awbNumber).map((item) => item.awbNumber)).size,
    totalUploadedImages: items.length,
    matchedCount: items.filter((item) => item.statusLabel === 'Matched').length,
    needsReviewCount: items.filter((item) => item.statusLabel === 'Needs Review').length,
    skippedCount: items.filter((item) => item.statusLabel === 'Skipped').length,
    unmappedCount: items.filter((item) => item.statusLabel === 'Unmapped').length,
  };
}

function appendAudit(item: ProcessedItem, actor: string, description: string): ProcessedItem {
  return {
    ...item,
    auditTrail: [
      ...item.auditTrail,
      {
        id: `${item.id}-${item.auditTrail.length + 1}`,
        timestamp: new Date().toISOString(),
        actor,
        description,
      },
    ],
  };
}

function getWorkflowItemResolution(item: ProcessedItem) {
  const isManualMatch =
    item.deliveryReviewStatus !== null ||
    /manually/i.test(item.reason) ||
    item.auditTrail.some((event) => /manually/i.test(event.description));

  const finalMatchStatus: FinalMatchStatus =
    item.statusLabel === 'Skipped'
      ? 'skipped'
      : isManualMatch
        ? 'manually_matched'
        : 'matched';

  const failureReason =
    item.statusLabel === 'Unmapped'
      ? 'Unmapped POD image'
      : item.statusLabel === 'Skipped'
        ? 'Skipped review row not eligible for submission'
        : item.statusLabel === 'Needs Review' && !isManualMatch
          ? 'Review not resolved'
          : null;

  return {
    finalMatchStatus,
    failureReason,
    deliveryReviewStatus: item.deliveryReviewStatus ?? null,
  };
}

function buildSubmissionJobItem(item: ProcessedItem): EpodSubmissionJobItem {
  const resolution = getWorkflowItemResolution(item);
  const status: SubmissionRowStatus = resolution.failureReason ? 'Failed' : 'Submitted';

  return {
    id: item.id,
    workflowItemId: item.id,
    awbNumber: item.awbNumber ?? null,
    shipmentId: item.shipmentId ?? null,
    fileName: item.fileName,
    vehicleInfo: item.transporter ?? item.shipmentId ?? item.awbNumber ?? null,
    finalMatchStatus: resolution.finalMatchStatus,
    status,
    failureReason: resolution.failureReason,
    deliveryReviewStatus: resolution.deliveryReviewStatus,
  };
}

function createSubmissionJobSnapshot(state: EpodSubmissionJobState): EpodSubmissionJob {
  const visibleItems = state.allItems.slice(0, state.visibleCount);
  return {
    jobId: state.jobId,
    batchId: state.batchId,
    source: state.source,
    createdBy: state.createdBy,
    status: state.status,
    totalFiles: state.totalFiles,
    processedCount: visibleItems.length,
    submittedCount: visibleItems.filter((item) => item.status === 'Submitted').length,
    failedCount: visibleItems.filter((item) => item.status === 'Failed').length,
    pendingCount: Math.max(0, state.totalFiles - visibleItems.length),
    attempt: state.attempt,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
    cancelledAt: state.cancelledAt,
    items: visibleItems,
  };
}

function refreshSubmissionJob(state: EpodSubmissionJobState, now = new Date()) {
  if (state.status !== 'in_progress') {
    return state;
  }

  const elapsed = now.getTime() - new Date(state.startedAt).getTime();
  const visibleTarget = Math.min(
    state.totalFiles,
    state.baselineVisibleCount + Math.max(0, Math.floor(elapsed / SUBMISSION_PROGRESS_STEP_MS)),
  );

  if (visibleTarget > state.visibleCount) {
    state.visibleCount = visibleTarget;
    state.updatedAt = now.toISOString();
  }

  if (state.visibleCount >= state.totalFiles) {
    const visibleItems = state.allItems.slice(0, state.totalFiles);
    const failedCount = visibleItems.filter((item) => item.status === 'Failed').length;
    state.status = failedCount > 0 ? 'failed' : 'success';
    state.completedAt = now.toISOString();
    state.updatedAt = now.toISOString();
  }

  return state;
}

function getSubmissionWorkflowItems(
  workflowItems: ProcessedItem[],
  itemIds?: string[] | null,
) {
  if (!itemIds || itemIds.length === 0) {
    return workflowItems;
  }

  const wanted = new Set(itemIds);
  return workflowItems.filter((item) => wanted.has(item.id));
}

function buildSubmissionStateFromWorkflow(
  result: EpodProcessResult,
  input: {
    batchId: string;
    source?: string | null;
    createdBy?: string | null;
    itemIds?: string[] | null;
  },
  previousState?: EpodSubmissionJobState,
): EpodSubmissionJobState {
  const workflowItems = getSubmissionWorkflowItems(result.items, input.itemIds);
  const submittedPrefix = previousState?.allItems.filter((item) => item.status === 'Submitted') ?? [];
  const freshItems = workflowItems.map(buildSubmissionJobItem);
  const allItems = previousState ? [...submittedPrefix, ...freshItems] : freshItems;
  const baselineVisibleCount = submittedPrefix.length;
  const startedAt = new Date().toISOString();

  return {
    jobId: previousState?.jobId ?? crypto.randomUUID(),
    batchId: input.batchId,
    source: input.source ?? previousState?.source ?? null,
    createdBy: input.createdBy ?? previousState?.createdBy ?? null,
    status: 'in_progress',
    totalFiles: allItems.length,
    attempt: (previousState?.attempt ?? 0) + 1,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    cancelledAt: previousState?.cancelledAt ?? null,
    allItems,
    visibleCount: baselineVisibleCount,
    baselineVisibleCount,
    sourceItemIds: workflowItems.map((item) => item.id),
  };
}

export function createWorkflow(result: EpodProcessResult): EpodWorkflowState {
  const batchId = crypto.randomUUID();
  const state: EpodWorkflowState = {
    batchId,
    summary: recomputeSummary(result.items),
    items: result.items,
  };
  workflowStore.set(batchId, state);
  return state;
}

export function getWorkflow(batchId: string) {
  return workflowStore.get(batchId) ?? null;
}

export function createSubmissionJob(input: {
  batchId: string;
  source?: string | null;
  createdBy?: string | null;
  itemIds?: string[] | null;
}) {
  const workflow = workflowStore.get(input.batchId);
  if (!workflow) {
    throw new Error('Workflow batch not found');
  }

  const state = buildSubmissionStateFromWorkflow(workflow, input);
  submissionJobStore.set(state.jobId, state);
  return createSubmissionJobSnapshot(state);
}

export function getSubmissionJob(jobId: string) {
  const state = submissionJobStore.get(jobId);
  if (!state) {
    return null;
  }

  refreshSubmissionJob(state);
  submissionJobStore.set(jobId, state);
  return createSubmissionJobSnapshot(state);
}

export function cancelSubmissionJob(jobId: string, actor = 'system') {
  const state = submissionJobStore.get(jobId);
  if (!state) {
    throw new Error('Submission job not found');
  }
  if (state.status === 'success' || state.status === 'failed' || state.status === 'cancelled') {
    return createSubmissionJobSnapshot(state);
  }

  const now = new Date().toISOString();
  state.status = 'cancelled';
  state.cancelledAt = now;
  state.updatedAt = now;
  state.allItems = state.allItems.map((item) => ({
    ...item,
  }));
  submissionJobStore.set(jobId, state);
  return createSubmissionJobSnapshot(state);
}

export function resubmitSubmissionJob(input: {
  jobId: string;
  actor?: string | null;
  itemIds?: string[] | null;
}) {
  const state = submissionJobStore.get(input.jobId);
  if (!state) {
    throw new Error('Submission job not found');
  }
  if (state.status === 'cancelled') {
    throw new Error('Cannot resubmit a cancelled job');
  }

  const workflow = workflowStore.get(state.batchId);
  if (!workflow) {
    throw new Error('Workflow batch not found');
  }

  const failedIds = new Set(
    state.allItems
      .filter((item) => item.status === 'Failed')
      .map((item) => item.workflowItemId),
  );
  const requestedIds = input.itemIds && input.itemIds.length > 0 ? new Set(input.itemIds) : null;
  const retryWorkflowItems = workflow.items.filter((item) => {
    const failed = failedIds.has(item.id);
    return requestedIds ? failed && requestedIds.has(item.id) : failed;
  });

  if (retryWorkflowItems.length === 0) {
    return createSubmissionJobSnapshot(state);
  }

  const submittedItems = state.allItems.filter((item) => item.status === 'Submitted');
  const retryItems = retryWorkflowItems.map(buildSubmissionJobItem);
  const now = new Date().toISOString();

  state.attempt += 1;
  state.status = 'in_progress';
  state.startedAt = now;
  state.updatedAt = now;
  state.completedAt = null;
  state.baselineVisibleCount = submittedItems.length;
  state.visibleCount = submittedItems.length;
  state.allItems = [...submittedItems, ...retryItems];
  state.totalFiles = state.allItems.length;
  state.sourceItemIds = [...submittedItems.map((item) => item.workflowItemId), ...retryItems.map((item) => item.workflowItemId)];

  submissionJobStore.set(state.jobId, state);
  return createSubmissionJobSnapshot(state);
}

export function applyWorkflowAction(input: {
  batchId: string;
  itemId: string;
  actor: string;
  actionType: 'document' | 'line-review' | 'line-override' | 'exception-resolve' | 'ocr-update';
  documentAction?: 'accept' | 'reject' | 'review' | 'sendToReviewer' | 'approve';
  lineId?: string;
  reviewAction?: 'ACCEPTED' | 'REJECTED';
  exceptionId?: string;
  ocrPatch?: ProcessedOcrPatch;
}) {
  const state = workflowStore.get(input.batchId);
  if (!state) {
    throw new Error('Workflow batch not found');
  }

  const items = state.items.map((item) => {
    if (item.id !== input.itemId) {
      return item;
    }

    if (input.actionType === 'document' && input.documentAction) {
      switch (input.documentAction) {
        case 'accept':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Matched',
              statusVariant: 'success',
              reason: 'Accepted after processing review',
              exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })),
            },
            input.actor,
            'Document accepted during processing review',
          );
        case 'reject':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Skipped',
              statusVariant: 'danger',
              reason: 'Rejected during processing review',
            },
            input.actor,
            'Document rejected during processing review',
          );
        case 'review':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Needs Review',
              statusVariant: 'warning',
              reason: 'Marked for manual review',
            },
            input.actor,
            'Document marked for manual review',
          );
        case 'sendToReviewer':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Needs Review',
              statusVariant: 'warning',
              reason: 'Sent to reviewer for final review',
            },
            input.actor,
            'Document sent to reviewer',
          );
        case 'approve':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Matched',
              statusVariant: 'success',
              reason: 'Approved by reviewer',
              exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })),
            },
            input.actor,
            'Document approved by reviewer',
          );
      }
    }

    if (input.actionType === 'line-review' && input.lineId && input.reviewAction) {
      const nextLineItems = item.lineItems.map((line) =>
        line.id === input.lineId ? { ...line, reviewAction: input.reviewAction } : line,
      );
      return appendAudit(
        {
          ...item,
          lineItems: nextLineItems,
          statusLabel: input.reviewAction === 'REJECTED' ? 'Needs Review' : item.statusLabel,
          statusVariant: input.reviewAction === 'REJECTED' ? 'warning' : item.statusVariant,
          reason: input.reviewAction === 'REJECTED' ? 'Line item rejected during review' : item.reason,
        },
        input.actor,
        `Line item ${input.lineId} marked ${input.reviewAction}`,
      );
    }

    if (input.actionType === 'line-override' && input.lineId) {
      const nextLineItems = item.lineItems.map((line) => {
        if (line.id !== input.lineId) {
          return line;
        }
        const receivedQty = line.sentQty;
        return {
          ...line,
          receivedQty,
          damagedQty: 0,
          difference: 0,
          reconStatus: 'MATCH' as const,
          reviewAction: 'OVERRIDDEN' as const,
          note: 'Override aligned received quantity with shipment data',
        };
      });
      return appendAudit(
        {
          ...item,
          lineItems: nextLineItems,
          statusLabel: 'Needs Review',
          statusVariant: 'warning',
          reason: 'Line item overridden during review',
        },
        input.actor,
        `Line item ${input.lineId} overridden to match shipment data`,
      );
    }

    if (input.actionType === 'exception-resolve' && input.exceptionId) {
      const exceptions = item.exceptions.map((exception) =>
        exception.id === input.exceptionId ? { ...exception, resolved: true } : exception,
      );
      const unresolvedCount = exceptions.filter((exception) => !exception.resolved).length;
      return appendAudit(
        {
          ...item,
          exceptions,
          statusLabel: unresolvedCount === 0 ? 'Matched' : 'Needs Review',
          statusVariant: unresolvedCount === 0 ? 'success' : 'warning',
          reason: unresolvedCount === 0 ? 'All exceptions resolved' : 'Review in progress',
        },
        input.actor,
        `Exception ${input.exceptionId} marked resolved`,
      );
    }

    if (input.actionType === 'ocr-update' && input.ocrPatch) {
      const nextOcrData = {
        ...item.ocrData,
        ...input.ocrPatch,
      };
      return appendAudit(
        {
          ...item,
          awbNumber: nextOcrData.extractedAwb ?? item.awbNumber,
          ocrData: nextOcrData,
          stampPresent: nextOcrData.stampPresent,
          signaturePresent: nextOcrData.signaturePresent,
          deliveryReviewStatus: nextOcrData.deliveryReviewStatus ?? item.deliveryReviewStatus ?? null,
          ocrFields: {
            ...item.ocrFields,
            awb_number: nextOcrData.extractedAwb,
            consignee_name: nextOcrData.extractedConsignee,
            delivery_date: nextOcrData.extractedDeliveryDate,
            consignor_name: nextOcrData.extractedFrom,
            to_city: nextOcrData.extractedTo,
            stamp_present: nextOcrData.stampPresent,
            signature_present: nextOcrData.signaturePresent,
            remarks: nextOcrData.remarks,
            condition_notes: nextOcrData.conditionNotes,
          },
          statusLabel: 'Needs Review',
          statusVariant: 'warning',
          reason: nextOcrData.deliveryReviewStatus
            ? `OCR fields edited manually and marked ${nextOcrData.deliveryReviewStatus === 'clean' ? 'clean delivery' : 'unclean delivery'}`
            : 'OCR fields edited manually',
        },
        input.actor,
        'OCR extracted fields updated manually',
      );
    }

    return item;
  });

  const nextState: EpodWorkflowState = {
    batchId: state.batchId,
    items,
    summary: recomputeSummary(items),
  };
  workflowStore.set(state.batchId, nextState);
  return nextState;
}
