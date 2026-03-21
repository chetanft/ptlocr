import type {
  EpodProcessResult,
  EpodSubmissionJob,
  EpodSubmissionJobItem,
  EpodWorkflowResult,
  ProcessedItem,
  ProcessedOcrPatch,
} from './epodApi';

const WORKFLOW_KEY = 'epod-client-workflows';
const SUBMISSION_KEY = 'epod-client-submissions';
const SUBMISSION_STEP_MS = 700;

type SubmissionState = EpodSubmissionJob & {
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  visibleCount: number;
  baseVisibleCount: number;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStore<T>(key: string): Record<string, T> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore<T>(key: string, value: Record<string, T>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearLocalEpodWorkflowState() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(WORKFLOW_KEY);
  window.localStorage.removeItem(SUBMISSION_KEY);
}

function generateId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function recomputeSummary(items: ProcessedItem[]) {
  return {
    totalAwbs: new Set(items.filter((item) => item.awbNumber).map((item) => item.awbNumber)).size,
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

export function createLocalWorkflow(result: EpodProcessResult, batchId = generateId()): EpodWorkflowResult {
  const workflows = readStore<EpodWorkflowResult>(WORKFLOW_KEY);
  const workflow: EpodWorkflowResult = {
    batchId,
    items: result.items,
    summary: recomputeSummary(result.items),
  };
  workflows[batchId] = workflow;
  writeStore(WORKFLOW_KEY, workflows);
  return workflow;
}

function getLocalWorkflow(batchId: string) {
  const workflows = readStore<EpodWorkflowResult>(WORKFLOW_KEY);
  return workflows[batchId] ?? null;
}

export function applyLocalWorkflowAction(input: {
  batchId: string;
  itemId: string;
  actor: string;
  actionType: 'document' | 'line-review' | 'line-override' | 'exception-resolve' | 'ocr-update';
  documentAction?: 'accept' | 'reject' | 'review' | 'sendToReviewer' | 'approve';
  lineId?: string;
  reviewAction?: 'ACCEPTED' | 'REJECTED';
  exceptionId?: string;
  ocrPatch?: ProcessedOcrPatch;
}): EpodWorkflowResult {
  const workflow = getLocalWorkflow(input.batchId);
  if (!workflow) {
    throw new Error('Workflow batch not found');
  }

  const items = workflow.items.map((item) => {
    if (item.id !== input.itemId) return item;

    if (input.actionType === 'document' && input.documentAction) {
      const manual = input.documentAction === 'accept' || input.documentAction === 'approve' || input.documentAction === 'sendToReviewer';
      const deliveryReviewStatus =
        item.deliveryReviewStatus ??
        (input.documentAction === 'reject' ? 'unclean' : input.documentAction === 'accept' || input.documentAction === 'approve' ? 'clean' : null);
      switch (input.documentAction) {
        case 'accept':
        case 'approve':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Matched',
              statusVariant: 'success',
              reason: input.documentAction === 'approve' ? 'Approved by reviewer' : 'Accepted after processing review',
              manuallyMatched: manual,
              finalMatchStatus: manual ? 'manually_matched' : 'matched',
              deliveryReviewStatus,
              exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })),
            },
            input.actor,
            input.documentAction === 'approve' ? 'Document approved by reviewer' : 'Document accepted during processing review',
          );
        case 'reject':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Skipped',
              statusVariant: 'danger',
              reason: 'Rejected during processing review',
              finalMatchStatus: 'skipped',
              deliveryReviewStatus: 'unclean',
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
              manuallyMatched: true,
              finalMatchStatus: 'manually_matched',
            },
            input.actor,
            'Document marked for manual review',
          );
        case 'sendToReviewer':
          return appendAudit(
            {
              ...item,
              statusLabel: 'Matched',
              statusVariant: 'success',
              reason: 'Resolved manually and sent to reviewer',
              manuallyMatched: true,
              finalMatchStatus: 'manually_matched',
              deliveryReviewStatus: deliveryReviewStatus ?? 'clean',
            },
            input.actor,
            'Document sent to reviewer',
          );
      }
    }

    if (input.actionType === 'line-review' && input.lineId && input.reviewAction) {
      return appendAudit(
        {
          ...item,
          lineItems: item.lineItems.map((line) => line.id === input.lineId ? { ...line, reviewAction: input.reviewAction } : line),
          manuallyMatched: true,
          finalMatchStatus: 'manually_matched',
          statusLabel: input.reviewAction === 'REJECTED' ? 'Needs Review' : item.statusLabel,
          statusVariant: input.reviewAction === 'REJECTED' ? 'warning' : item.statusVariant,
          reason: input.reviewAction === 'REJECTED' ? 'Line item rejected during review' : 'Line item accepted during review',
        },
        input.actor,
        `Line item ${input.lineId} marked ${input.reviewAction}`,
      );
    }

    if (input.actionType === 'line-override' && input.lineId) {
      return appendAudit(
        {
          ...item,
          lineItems: item.lineItems.map((line) =>
            line.id === input.lineId
              ? { ...line, receivedQty: line.sentQty, damagedQty: 0, difference: 0, reconStatus: 'MATCH', reviewAction: 'OVERRIDDEN', note: 'Override aligned received quantity with shipment data' }
              : line,
          ),
          manuallyMatched: true,
          finalMatchStatus: 'manually_matched',
          statusLabel: 'Needs Review',
          statusVariant: 'warning',
          reason: 'Line item overridden during review',
        },
        input.actor,
        `Line item ${input.lineId} overridden`,
      );
    }

    if (input.actionType === 'exception-resolve' && input.exceptionId) {
      const exceptions = item.exceptions.map((exception) =>
        exception.id === input.exceptionId ? { ...exception, resolved: true } : exception,
      );
      const unresolved = exceptions.some((exception) => !exception.resolved);
      return appendAudit(
        {
          ...item,
          exceptions,
          manuallyMatched: true,
          finalMatchStatus: 'manually_matched',
          statusLabel: unresolved ? 'Needs Review' : 'Matched',
          statusVariant: unresolved ? 'warning' : 'success',
          reason: unresolved ? 'Review in progress' : 'All exceptions resolved',
        },
        input.actor,
        `Exception ${input.exceptionId} resolved`,
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
          deliveryReviewStatus: nextOcrData.deliveryReviewStatus ?? item.deliveryReviewStatus ?? null,
          manuallyMatched: true,
          finalMatchStatus: 'manually_matched',
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

  const next = {
    batchId: workflow.batchId,
    items,
    summary: recomputeSummary(items),
  };
  const workflows = readStore<EpodWorkflowResult>(WORKFLOW_KEY);
  workflows[input.batchId] = next;
  writeStore(WORKFLOW_KEY, workflows);
  return next;
}

function getFinalMatchStatus(item: ProcessedItem) {
  if (item.finalMatchStatus) return item.finalMatchStatus;
  if (item.statusLabel === 'Skipped') return 'skipped';
  if (item.manuallyMatched || item.deliveryReviewStatus !== null) return 'manually_matched';
  return 'matched';
}

function createSubmissionItem(item: ProcessedItem): EpodSubmissionJobItem {
  const status = item.statusLabel === 'Skipped' || item.statusLabel === 'Unmapped' ? 'Failed' : 'Submitted';
  return {
    id: item.id,
    awbNumber: item.awbNumber ?? null,
    shipmentId: item.shipmentId ?? null,
    fileName: item.fileName,
    vehicleInfo: item.transporter ?? item.shipmentId ?? item.awbNumber ?? null,
    status,
    failureReason: status === 'Failed' ? item.reason : null,
  };
}

export function createLocalSubmissionJob(input: {
  batchId: string;
  itemIds?: string[];
}, jobId = generateId()): EpodSubmissionJob {
  const workflow = getLocalWorkflow(input.batchId);
  if (!workflow) {
    throw new Error('Workflow batch not found');
  }
  const picked = input.itemIds?.length
    ? workflow.items.filter((item) => input.itemIds?.includes(item.id))
    : workflow.items;
  const items = picked.map(createSubmissionItem);
  const now = new Date().toISOString();
  const jobs = readStore<SubmissionState>(SUBMISSION_KEY);
  jobs[jobId] = {
    jobId,
    batchId: input.batchId,
    status: 'in_progress',
    totalFiles: items.length,
    submittedCount: 0,
    failedCount: 0,
    items,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    visibleCount: 0,
    baseVisibleCount: 0,
  };
  writeStore(SUBMISSION_KEY, jobs);
  return getLocalSubmissionJob(jobId)!;
}

export function getLocalSubmissionJob(jobId: string): EpodSubmissionJob | null {
  const jobs = readStore<SubmissionState>(SUBMISSION_KEY);
  const job = jobs[jobId];
  if (!job) return null;

  if (job.status === 'in_progress') {
    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const visibleCount = Math.min(job.totalFiles, job.baseVisibleCount + Math.max(0, Math.floor(elapsed / SUBMISSION_STEP_MS)));
    job.visibleCount = visibleCount;
    const visibleItems = job.items.map((item, index) => {
      if (index < visibleCount) return item;
      return { ...item, status: 'Submitting' as const };
    });
    const settled = visibleItems.slice(0, visibleCount);
    job.submittedCount = settled.filter((item) => item.status === 'Submitted').length;
    job.failedCount = settled.filter((item) => item.status === 'Failed').length;
    job.updatedAt = new Date().toISOString();
    if (visibleCount >= job.totalFiles) {
      job.status = job.failedCount > 0 ? 'failed' : 'success';
      job.completedAt = new Date().toISOString();
    }
    job.items = visibleItems;
    jobs[jobId] = job;
    writeStore(SUBMISSION_KEY, jobs);
  }

  return {
    jobId: job.jobId,
    batchId: job.batchId,
    status: job.status,
    totalFiles: job.totalFiles,
    submittedCount: job.submittedCount,
    failedCount: job.failedCount,
    items: job.items,
  };
}

export function cancelLocalSubmissionJob(jobId: string): EpodSubmissionJob {
  const jobs = readStore<SubmissionState>(SUBMISSION_KEY);
  const job = jobs[jobId];
  if (!job) throw new Error('Submission job not found');
  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  jobs[jobId] = job;
  writeStore(SUBMISSION_KEY, jobs);
  return getLocalSubmissionJob(jobId)!;
}

export function resubmitLocalSubmissionJob(jobId: string, itemIds?: string[]): EpodSubmissionJob {
  const jobs = readStore<SubmissionState>(SUBMISSION_KEY);
  const job = jobs[jobId];
  if (!job) throw new Error('Submission job not found');
  const retryIds = new Set(itemIds?.length ? itemIds : job.items.filter((item) => item.status === 'Failed').map((item) => item.id));
  const alreadySubmitted = job.items.filter((item) => item.status === 'Submitted');
  const retryItems = job.items
    .filter((item) => retryIds.has(item.id))
    .map((item) => ({ ...item, status: 'Submitted' as const, failureReason: null }));
  const now = new Date().toISOString();
  jobs[jobId] = {
    ...job,
    status: 'in_progress',
    items: [...alreadySubmitted, ...retryItems],
    totalFiles: alreadySubmitted.length + retryItems.length,
    submittedCount: 0,
    failedCount: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    baseVisibleCount: alreadySubmitted.length,
    visibleCount: alreadySubmitted.length,
  };
  writeStore(SUBMISSION_KEY, jobs);
  return getLocalSubmissionJob(jobId)!;
}
