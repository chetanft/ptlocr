export interface ProcessedLineItem {
  id: string;
  sku: string | null;
  description: string;
  sentQty: number;
  receivedQty: number;
  damagedQty: number;
  difference: number;
  reconStatus: 'MATCH' | 'SHORT' | 'EXCESS' | 'DAMAGED';
  reviewAction?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
  note?: string | null;
}

export interface ProcessedException {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  resolved: boolean;
}

export interface ProcessedAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  description: string;
}

export interface ProcessedSystemData {
  awbNumber: string | null;
  shipmentId: string | null;
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  deliveredDate: string | null;
  packages: number | null;
}

export type ProcessedFieldValue = string | number | null;

export interface ProcessedOcrData {
  extractedAwb: string | null;
  extractedConsignee: string | null;
  extractedDeliveryDate: string | null;
  extractedFrom: string | null;
  extractedTo: string | null;
  receivedQuantityNotes?: string | null;
  carrier?: ProcessedFieldValue;
  documentType?: ProcessedFieldValue;
  bookingBranch?: ProcessedFieldValue;
  pickupDate?: ProcessedFieldValue;
  shipDate?: ProcessedFieldValue;
  consignor?: ProcessedFieldValue;
  consignorAddress?: ProcessedFieldValue;
  consignorPhone?: ProcessedFieldValue;
  consignorPin?: ProcessedFieldValue;
  consignorGst?: ProcessedFieldValue;
  consigneeAddress?: ProcessedFieldValue;
  consigneePhone?: ProcessedFieldValue;
  consigneePin?: ProcessedFieldValue;
  consigneeGst?: ProcessedFieldValue;
  pinCode?: ProcessedFieldValue;
  packageWeight?: ProcessedFieldValue;
  invoiceValue?: ProcessedFieldValue;
  invoiceCount?: ProcessedFieldValue;
  invoiceNumbers?: ProcessedFieldValue;
  freightAmount?: ProcessedFieldValue;
  freightMode?: ProcessedFieldValue;
  paymentMode?: ProcessedFieldValue;
  ewaybillNumber?: ProcessedFieldValue;
  dimensions?: ProcessedFieldValue;
  receiverStamp?: ProcessedFieldValue;
  receiverName?: ProcessedFieldValue;
  receiverPhone?: ProcessedFieldValue;
  vehicleNumber?: ProcessedFieldValue;
  podCopyType?: ProcessedFieldValue;
  stampPresent: boolean;
  signaturePresent: boolean;
  remarks: string | null;
  conditionNotes: string | null;
  description: string | null;
  packages: number | null;
  rawFields: Record<string, unknown>;
}

export interface ProcessedOcrPatch {
  extractedAwb?: string | null;
  extractedConsignee?: string | null;
  extractedDeliveryDate?: string | null;
  extractedFrom?: string | null;
  extractedTo?: string | null;
  description?: string | null;
  receivedQuantityNotes?: string | null;
  stampPresent?: boolean;
  signaturePresent?: boolean;
  remarks?: string | null;
  conditionNotes?: string | null;
  deliveryReviewStatus?: 'clean' | 'unclean' | null;
}

export interface ProcessedItem {
  id: string;
  processingMode?: 'bulk' | 'selection';
  bucket?: 'matched' | 'needs_review' | 'unmapped' | 'skipped';
  finalMatchStatus?: 'matched' | 'manually_matched' | 'skipped';
  manuallyMatched?: boolean;
  fileName: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  consigneeName: string | null;
  statusLabel: 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
  statusVariant: 'success' | 'warning' | 'danger' | 'secondary';
  reason: string;
  confidence: number;
  confidenceLabel: string;
  stampPresent: boolean;
  signaturePresent: boolean;
  invoiceNumberExtracted?: string | null;
  invoiceNumberSystem?: string | null;
  sentQty?: number | null;
  receivedQty?: number | null;
  difference?: number | null;
  deliveryReviewStatus?: 'clean' | 'unclean' | null;
  finalDocumentDecision?: 'clean' | 'unclean' | 'rejected' | null;
  systemData: ProcessedSystemData;
  ocrData: ProcessedOcrData;
  lineItems: ProcessedLineItem[];
  exceptions: ProcessedException[];
  auditTrail: ProcessedAuditEvent[];
  ocrFields: Record<string, unknown>;
}

export type ReviewFinalMatchStatus = 'matched' | 'manually_matched' | 'skipped' | 'rejected';

export function getReviewFinalMatchStatus(item: Pick<ProcessedItem, 'finalMatchStatus' | 'manuallyMatched' | 'statusLabel' | 'deliveryReviewStatus' | 'reason' | 'finalDocumentDecision'>): ReviewFinalMatchStatus {
  if (item.finalDocumentDecision === 'rejected') {
    return 'rejected';
  }

  if (item.finalMatchStatus) {
    return item.finalMatchStatus;
  }

  if (item.manuallyMatched) {
    return 'manually_matched';
  }

  if (item.statusLabel === 'Skipped') {
    return 'skipped';
  }

  if (item.statusLabel === 'Matched') {
    return 'matched';
  }

  return 'manually_matched';
}

export function getReviewFinalMatchLabel(status: ReviewFinalMatchStatus): string {
  switch (status) {
    case 'manually_matched':
      return 'Manually matched';
    case 'rejected':
      return 'Rejected';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Matched';
  }
}

export function getDeliveryStatusLabel(status?: 'clean' | 'unclean' | null): string {
  if (status === 'clean') return 'Clean';
  if (status === 'unclean') return 'Unclean';
  return '—';
}

export function getDeliveryStatusVariant(status?: 'clean' | 'unclean' | null): 'success' | 'warning' | 'secondary' {
  if (status === 'clean') return 'success';
  if (status === 'unclean') return 'warning';
  return 'secondary';
}

function countMatchedAwbs(items: ProcessedItem[]) {
  return new Set(
    items
      .filter((item) => item.statusLabel !== 'Unmapped' && item.awbNumber)
      .map((item) => String(item.awbNumber).replace(/[\s._-]/g, '').toUpperCase()),
  ).size;
}

export interface EpodProcessResult {
  summary: {
    totalAwbs: number;
    totalUploadedImages: number;
    matchedCount: number;
    needsReviewCount: number;
    skippedCount: number;
    unmappedCount: number;
  };
  items: ProcessedItem[];
}

export interface EpodWorkflowResult extends EpodProcessResult {
  batchId: string;
}

export interface LineOverridePatch {
  receivedQty: number;
  damagedQty: number;
  note?: string | null;
}

export interface EpodSubmissionJobItem {
  id: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fileName: string;
  vehicleInfo: string | null;
  status: 'Queued' | 'Submitting' | 'Submitted' | 'Failed';
  failureReason?: string | null;
}

export interface EpodSubmissionJob {
  jobId: string;
  batchId: string;
  status: 'in_progress' | 'success' | 'failed' | 'cancelled';
  totalFiles: number;
  submittedCount: number;
  failedCount: number;
  items: EpodSubmissionJobItem[];
}

/**
 * Process a single file against the ePOD API.
 * Sends one file at a time to stay under Vercel's 4.5MB body limit.
 */
async function processSingleFile(
  file: File,
  selectedAwbs: string[],
  source: string,
  actor: string,
): Promise<EpodProcessResult> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('selectedAwbs', JSON.stringify(selectedAwbs));
  formData.append('source', source);
  formData.append('actor', actor);

  const res = await fetch('/api/epod/process', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Processing failed for ${file.name}`);
  }

  return res.json();
}

/**
 * Process multiple ePOD files by sending them one at a time
 * and aggregating the results. This avoids Vercel's 4.5MB body limit.
 */
export async function processEpodFiles(
  files: File[],
  selectedAwbs: string[],
  source: string = 'TRANSPORTER_PORTAL',
  actor: string = 'transporter',
  onProgress?: (completed: number, total: number, stage: number) => void,
): Promise<EpodProcessResult> {
  const allItems: ProcessedItem[] = [];

  for (let i = 0; i < files.length; i++) {
    // Stage 0: Reading file (immediate)
    onProgress?.(i, files.length, 0);

    // Stage 1: Extracting AWB and POD fields (starts with API call)
    const stageTimer = setTimeout(() => onProgress?.(i, files.length, 1), 300);
    // Stage 2: Matching (simulated ~2s into the call)
    const matchTimer = setTimeout(() => onProgress?.(i, files.length, 2), 2500);

    const result = await processSingleFile(files[i], selectedAwbs, source, actor);

    clearTimeout(stageTimer);
    clearTimeout(matchTimer);

    // Stage 3: Preparing reconciliation buckets (file done)
    onProgress?.(i + 1, files.length, 3);

    allItems.push(...result.items);
  }

  // Aggregate summary
  const summary = {
    totalAwbs: selectedAwbs.length || countMatchedAwbs(allItems),
    totalUploadedImages: files.length,
    matchedCount: allItems.filter(i => i.statusLabel === 'Matched').length,
    needsReviewCount: allItems.filter(i => i.statusLabel === 'Needs Review').length,
    skippedCount: allItems.filter(i => i.statusLabel === 'Skipped').length,
    unmappedCount: allItems.filter(i => i.statusLabel === 'Unmapped').length,
  };

  return { summary, items: allItems };
}

export async function createEpodWorkflow(result: EpodProcessResult): Promise<EpodWorkflowResult> {
  return createLocalWorkflow(result);
}

export async function applyEpodWorkflowAction(input: {
  batchId: string;
  itemId: string;
  actor: string;
  actionType: 'document' | 'line-review' | 'line-override' | 'exception-resolve' | 'ocr-update';
  documentAction?: 'accept' | 'reject' | 'review' | 'sendToReviewer' | 'approve' | 'approveClean' | 'approveUnclean' | 'approveRejection';
  lineId?: string;
  reviewAction?: 'ACCEPTED' | 'REJECTED';
  overridePatch?: LineOverridePatch;
  exceptionId?: string;
  ocrPatch?: ProcessedOcrPatch;
}): Promise<EpodWorkflowResult> {
  return applyLocalWorkflowAction(input);
}

export async function createEpodSubmissionJob(input: {
  batchId: string;
  actor: string;
  source?: string;
  createdBy?: string;
  itemIds?: string[];
}): Promise<EpodSubmissionJob> {
  return createLocalSubmissionJob({ batchId: input.batchId, itemIds: input.itemIds });
}

export async function getEpodSubmissionJob(jobId: string): Promise<EpodSubmissionJob> {
  const local = getLocalSubmissionJob(jobId);
  if (local) return local;
  throw new Error('Failed to fetch submission job');
}

export async function resubmitEpodSubmissionJob(jobId: string, itemIds?: string[]): Promise<EpodSubmissionJob> {
  return resubmitLocalSubmissionJob(jobId, itemIds);
}

export async function cancelEpodSubmissionJob(jobId: string): Promise<EpodSubmissionJob> {
  return cancelLocalSubmissionJob(jobId);
}
import {
  applyLocalWorkflowAction,
  cancelLocalSubmissionJob,
  createLocalSubmissionJob,
  createLocalWorkflow,
  getLocalSubmissionJob,
  resubmitLocalSubmissionJob,
} from './epodClientStore';
