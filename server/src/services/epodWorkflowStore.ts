import crypto from 'crypto';

type StatusLabel = 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
type StatusVariant = 'success' | 'warning' | 'danger' | 'secondary';
type SubmissionJobStatus = 'in_progress' | 'success' | 'failed' | 'cancelled';
type SubmissionRowStatus = 'Submitted' | 'Failed';
type FinalMatchStatus = 'matched' | 'manually_matched' | 'skipped';

export interface EpodWorkflowItem {
  id: string;
  fileName: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  consigneeName: string | null;
  statusLabel: StatusLabel;
  statusVariant: StatusVariant;
  reason: string;
  confidence: number;
  confidenceLabel: string;
  stampPresent: boolean;
  signaturePresent: boolean;
  deliveryReviewStatus?: 'clean' | 'unclean' | null;
  systemData: any;
  ocrData: any;
  lineItems: any[];
  exceptions: any[];
  auditTrail: any[];
  ocrFields: Record<string, unknown>;
}

export interface EpodWorkflowState {
  batchId: string;
  summary: {
    totalAwbs: number;
    totalUploadedImages: number;
    matchedCount: number;
    needsReviewCount: number;
    skippedCount: number;
    unmappedCount: number;
  };
  items: EpodWorkflowItem[];
}

const workflowStore = new Map<string, EpodWorkflowState>();
const submissionJobStore = new Map<string, EpodSubmissionJobState>();
const SUBMISSION_PROGRESS_STEP_MS = 700;

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

function recomputeSummary(items: EpodWorkflowItem[]) {
  return {
    totalAwbs: new Set(items.filter((item) => !!item.awbNumber).map((item) => item.awbNumber)).size,
    totalUploadedImages: items.length,
    matchedCount: items.filter((item) => item.statusLabel === 'Matched').length,
    needsReviewCount: items.filter((item) => item.statusLabel === 'Needs Review').length,
    skippedCount: items.filter((item) => item.statusLabel === 'Skipped').length,
    unmappedCount: items.filter((item) => item.statusLabel === 'Unmapped').length,
  };
}

function appendAudit(item: EpodWorkflowItem, actor: string, description: string): EpodWorkflowItem {
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

function getWorkflowItemResolution(item: EpodWorkflowItem) {
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
        : null;

  return {
    finalMatchStatus,
    failureReason,
    deliveryReviewStatus: item.deliveryReviewStatus ?? null,
  };
}

function buildSubmissionJobItem(item: EpodWorkflowItem): EpodSubmissionJobItem {
  const resolution = getWorkflowItemResolution(item);

  return {
    id: item.id,
    workflowItemId: item.id,
    awbNumber: item.awbNumber ?? null,
    shipmentId: item.shipmentId ?? null,
    fileName: item.fileName,
    vehicleInfo: item.transporter ?? item.shipmentId ?? item.awbNumber ?? null,
    finalMatchStatus: resolution.finalMatchStatus,
    status: resolution.failureReason ? 'Failed' : 'Submitted',
    failureReason: resolution.failureReason,
    deliveryReviewStatus: resolution.deliveryReviewStatus,
  };
}

function getSubmissionWorkflowItems(workflowItems: EpodWorkflowItem[], itemIds?: string[] | null) {
  if (!itemIds || itemIds.length === 0) {
    return workflowItems;
  }

  const wanted = new Set(itemIds);
  return workflowItems.filter((item) => wanted.has(item.id));
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

function buildSubmissionStateFromWorkflow(
  workflowItems: EpodWorkflowItem[],
  input: {
    batchId: string;
    source?: string | null;
    createdBy?: string | null;
    itemIds?: string[] | null;
  },
  previousState?: EpodSubmissionJobState,
): EpodSubmissionJobState {
  const targetWorkflowItems = getSubmissionWorkflowItems(workflowItems, input.itemIds);
  const submittedPrefix = previousState?.allItems.filter((item) => item.status === 'Submitted') ?? [];
  const freshItems = targetWorkflowItems.map(buildSubmissionJobItem);
  const allItems = previousState ? [...submittedPrefix, ...freshItems] : freshItems;
  const baselineVisibleCount = submittedPrefix.length;
  const now = new Date().toISOString();

  return {
    jobId: previousState?.jobId ?? crypto.randomUUID(),
    batchId: input.batchId,
    source: input.source ?? previousState?.source ?? null,
    createdBy: input.createdBy ?? previousState?.createdBy ?? null,
    status: 'in_progress',
    totalFiles: allItems.length,
    attempt: (previousState?.attempt ?? 0) + 1,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    cancelledAt: previousState?.cancelledAt ?? null,
    allItems,
    visibleCount: baselineVisibleCount,
    baselineVisibleCount,
    sourceItemIds: targetWorkflowItems.map((item) => item.id),
  };
}

export const epodWorkflowStore = {
  create(result: { summary: EpodWorkflowState['summary']; items: EpodWorkflowItem[] }) {
    const batchId = crypto.randomUUID();
    const state: EpodWorkflowState = {
      batchId,
      summary: recomputeSummary(result.items),
      items: result.items,
    };
    workflowStore.set(batchId, state);
    return state;
  },

  get(batchId: string) {
    return workflowStore.get(batchId) ?? null;
  },

  applyAction(input: {
    batchId: string;
    itemId: string;
    actor: string;
    actionType: 'document' | 'line-review' | 'line-override' | 'exception-resolve' | 'ocr-update';
    documentAction?: 'accept' | 'reject' | 'review' | 'sendToReviewer' | 'approve';
    lineId?: string;
    reviewAction?: 'ACCEPTED' | 'REJECTED';
    exceptionId?: string;
    ocrPatch?: {
      extractedAwb?: string | null;
      extractedConsignee?: string | null;
      extractedDeliveryDate?: string | null;
      extractedFrom?: string | null;
      extractedTo?: string | null;
      stampPresent?: boolean;
      signaturePresent?: boolean;
      remarks?: string | null;
      conditionNotes?: string | null;
      deliveryReviewStatus?: 'clean' | 'unclean' | null;
    };
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
            return appendAudit({ ...item, statusLabel: 'Matched', statusVariant: 'success', reason: 'Accepted after processing review', exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })) }, input.actor, 'Document accepted during processing review');
          case 'reject':
            return appendAudit({ ...item, statusLabel: 'Skipped', statusVariant: 'danger', reason: 'Rejected during processing review' }, input.actor, 'Document rejected during processing review');
          case 'review':
            return appendAudit({ ...item, statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Marked for manual review' }, input.actor, 'Document marked for manual review');
          case 'sendToReviewer':
            return appendAudit({ ...item, statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Sent to reviewer for final review' }, input.actor, 'Document sent to reviewer');
          case 'approve':
            return appendAudit({ ...item, statusLabel: 'Matched', statusVariant: 'success', reason: 'Approved by reviewer', exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })) }, input.actor, 'Document approved by reviewer');
        }
      }

      if (input.actionType === 'line-review' && input.lineId && input.reviewAction) {
        return appendAudit(
          {
            ...item,
            lineItems: item.lineItems.map((line) => line.id === input.lineId ? { ...line, reviewAction: input.reviewAction } : line),
            statusLabel: input.reviewAction === 'REJECTED' ? 'Needs Review' : item.statusLabel,
            statusVariant: input.reviewAction === 'REJECTED' ? 'warning' : item.statusVariant,
            reason: input.reviewAction === 'REJECTED' ? 'Line item rejected during review' : item.reason,
          },
          input.actor,
          `Line item ${input.lineId} marked ${input.reviewAction}`,
        );
      }

      if (input.actionType === 'line-override' && input.lineId) {
        return appendAudit(
          {
            ...item,
            lineItems: item.lineItems.map((line) => line.id === input.lineId ? { ...line, receivedQty: line.sentQty, damagedQty: 0, difference: 0, reconStatus: 'MATCH', reviewAction: 'OVERRIDDEN', note: 'Override aligned received quantity with shipment data' } : line),
            statusLabel: 'Needs Review',
            statusVariant: 'warning',
            reason: 'Line item overridden during review',
          },
          input.actor,
          `Line item ${input.lineId} overridden to match shipment data`,
        );
      }

      if (input.actionType === 'exception-resolve' && input.exceptionId) {
        const exceptions = item.exceptions.map((exception) => exception.id === input.exceptionId ? { ...exception, resolved: true } : exception);
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
        const nextOcrData = { ...item.ocrData, ...input.ocrPatch };
        return appendAudit(
          {
            ...item,
            awbNumber: nextOcrData.extractedAwb ?? item.awbNumber,
            ocrData: nextOcrData,
            stampPresent: nextOcrData.stampPresent,
            signaturePresent: nextOcrData.signaturePresent,
            deliveryReviewStatus: nextOcrData.deliveryReviewStatus ?? (item as any).deliveryReviewStatus ?? null,
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
  },

  createSubmissionJob(input: {
    batchId: string;
    source?: string | null;
    createdBy?: string | null;
    itemIds?: string[] | null;
  }) {
    const workflow = workflowStore.get(input.batchId);
    if (!workflow) {
      throw new Error('Workflow batch not found');
    }

    const state = buildSubmissionStateFromWorkflow(workflow.items, input);
    submissionJobStore.set(state.jobId, state);
    return createSubmissionJobSnapshot(state);
  },

  getSubmissionJob(jobId: string) {
    const state = submissionJobStore.get(jobId);
    if (!state) {
      return null;
    }

    refreshSubmissionJob(state);
    submissionJobStore.set(jobId, state);
    return createSubmissionJobSnapshot(state);
  },

  cancelSubmissionJob(jobId: string) {
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
    submissionJobStore.set(jobId, state);
    return createSubmissionJobSnapshot(state);
  },

  resubmitSubmissionJob(input: {
    jobId: string;
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
    state.sourceItemIds = [
      ...submittedItems.map((item) => item.workflowItemId),
      ...retryItems.map((item) => item.workflowItemId),
    ];

    submissionJobStore.set(state.jobId, state);
    return createSubmissionJobSnapshot(state);
  },
};
