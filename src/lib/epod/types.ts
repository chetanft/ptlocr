export interface EpodShipmentRow {
  awbNumber: string;
  shipmentId: string;
  consigneeName: string;
  origin: string;
  originCity: string;
  destination: string;
  transporter: string;
  packageCount: number;
  deliveredDate: string;
  uploadedAt?: string;
  exceptionSummary?: string;
  confidenceLabel?: string;
  lineItems?: Array<{
    sku: string | null;
    description: string;
    sentQty: number;
    receivedQty?: number | null;
    damagedQty?: number | null;
  }>;
  status: 'Pending Submission' | 'Pending Approval' | 'Rejected' | 'Approved';
}

export type EpodSelectedShipment = EpodShipmentRow;

export interface EpodExtractedPodData {
  awb_number: string | null;
  transporter_name: string | null;
  consignor_name: string | null;
  consignor_address?: string | null;
  consignor_phone?: string | null;
  consignor_pin?: string | null;
  gst_number_consignor?: string | null;
  consignee_name: string | null;
  consignee_address?: string | null;
  consignee_phone?: string | null;
  consignee_pin?: string | null;
  gst_number_consignee?: string | null;
  from_city: string | null;
  to_city: string | null;
  delivery_date: string | null;
  booking_date: string | null;
  booking_branch?: string | null;
  receiver_name: string | null;
  stamp_present: boolean;
  signature_present: boolean;
  no_of_packages: number | null;
  weight_kg: number | null;
  description: string | null;
  invoice_number: string | null;
  invoice_value: number | null;
  number_of_invoices?: number | null;
  freight_mode: string | null;
  docket_number: string | null;
  transporter_id?: string | null;
  vehicle_number: string | null;
  remarks: string | null;
  condition_notes: string | null;
  payment_mode?: string | null;
  pod_copy_type?: string | null;
}

export interface EpodExtractedPodRecord {
  fileName: string;
  transporter: string;
  filePath: string;
  extractedData: EpodExtractedPodData;
}

export type EpodDeliveryReviewStatus = 'clean' | 'unclean' | null;

export type EpodSelectedFlowReviewVariant =
  | 'clean'
  | 'stamp_missing'
  | 'signature_missing'
  | 'quantity_mismatch'
  | 'invoice_mismatch'
  | 'partial_extraction'
  | 'duplicate_upload'
  | 'not_applicable';

export interface EpodSelectedFlowReviewMeta {
  processingMode: 'selection';
  reviewVariant: EpodSelectedFlowReviewVariant;
  matchedAwb: string | null;
  invoiceNumberOriginal: string | null;
  invoiceNumberExtracted: string | null;
  invoiceValueOriginal: number | null;
  invoiceValueExtracted: number | null;
  packageCountOriginal: number | null;
  packageCountExtracted: number | null;
  stampPresentOriginal: boolean;
  stampPresentExtracted: boolean;
  signaturePresentOriginal: boolean;
  signaturePresentExtracted: boolean;
  deliveryReviewStatus: EpodDeliveryReviewStatus;
  discrepancyReasons: string[];
}

export interface EpodUploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploaded' | 'error';
  error?: string;
  previewUrl?: string;
  previewKind?: 'image' | 'pdf' | 'other';
  normalizedFileName?: string;
}

export interface EpodBatchJob {
  id: string;
  source?: string | null;
  createdBy?: string | null;
  selectedAwbs: string[];
  status: string;
  totalFiles: number;
  processedFiles: number;
  matchedCount: number;
  unmatchedCount: number;
  needsReviewCount: number;
  blockedCount: number;
  readyCount: number;
  submittedCount: number;
  failedCount: number;
  cancelledAt?: string | null;
  isProcessing?: boolean;
}

export interface EpodException {
  id: string;
  type: string;
  severity: string;
  description?: string | null;
  resolved: boolean;
}

export interface EpodApproval {
  id: string;
  level: number;
  action: string;
  actedBy?: string | null;
  actedAt?: string | null;
}

export interface EpodBatchItem {
  id: string;
  fileName: string;
  awbNumber?: string | null;
  extractedAwb?: string | null;
  shipmentId?: string | null;
  consigneeName?: string | null;
  origin?: string | null;
  originCity?: string | null;
  destination?: string | null;
  transporter?: string | null;
  status: string;
  epodItemStatus?: string | null;
  reviewBucket?: string | null;
  blockingReason?: string | null;
  warningReason?: string | null;
  submittedToConsignorAt?: string | null;
  isInSelectedScope: boolean;
  ocrConfidence?: number | null;
  exceptions: EpodException[];
  approvals: EpodApproval[];
}

export type EpodProcessingFilter =
  | 'all'
  | 'totalAwbs'
  | 'totalUploaded'
  | 'matched'
  | 'needsReview'
  | 'skipped'
  | 'unmapped';

export interface EpodProcessedDisplayRow {
  id: string;
  awbNumber: string;
  shipmentId: string | null;
  fileName: string;
  finalMatchStatus?: 'matched' | 'manually_matched' | 'skipped';
  manuallyMatched?: boolean;
  deliveryReviewStatus?: EpodDeliveryReviewStatus;
  attachmentLabel?: string | null;
  attachmentTooltip?: string | null;
  statusLabel: 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
  statusVariant: 'success' | 'warning' | 'danger' | 'secondary';
  reason: string;
  confidence: number | null;
  confidenceLabel: string;
}

export interface EpodSubmissionSummary {
  submittedCount: number;
  submittedIds: string[];
}

export type EpodSubmissionJobStatus = 'in_progress' | 'success' | 'failed' | 'cancelled';

export interface EpodSubmissionJobItem {
  id: string;
  workflowItemId?: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fileName: string;
  vehicleInfo: string | null;
  finalMatchStatus?: 'matched' | 'manually_matched' | 'skipped';
  deliveryReviewStatus?: EpodDeliveryReviewStatus;
  status: 'Queued' | 'Submitting' | 'Submitted' | 'Failed';
  failureReason?: string | null;
}

export interface EpodSubmissionJob {
  jobId: string;
  batchId?: string;
  status: EpodSubmissionJobStatus;
  totalFiles: number;
  processedCount?: number;
  submittedCount: number;
  failedCount: number;
  pendingCount?: number;
  attempt?: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  items: EpodSubmissionJobItem[];
}

export interface EpodUploadRouteState {
  selectedShipments: EpodSelectedShipment[];
  uploadMode?: 'selection' | 'bulk';
}
