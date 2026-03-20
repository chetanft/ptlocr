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
  status: 'Pending Submission' | 'Pending Approval' | 'Rejected' | 'Approved';
}

export interface EpodSelectedShipment extends EpodShipmentRow {}

export interface EpodExtractedPodData {
  awb_number: string | null;
  transporter_name: string | null;
  consignor_name: string | null;
  consignee_name: string | null;
  from_city: string | null;
  to_city: string | null;
  delivery_date: string | null;
  booking_date: string | null;
  receiver_name: string | null;
  stamp_present: boolean;
  signature_present: boolean;
  no_of_packages: number | null;
  weight_kg: number | null;
  description: string | null;
  invoice_number: string | null;
  invoice_value: number | null;
  freight_mode: string | null;
  docket_number: string | null;
  vehicle_number: string | null;
  remarks: string | null;
  condition_notes: string | null;
  booking_branch?: string | null;
  payment_mode?: string | null;
  pod_copy_type?: string | null;
  consignor_address?: string | null;
  consignor_phone?: string | null;
  consignor_pin?: string | null;
  consignee_address?: string | null;
  consignee_phone?: string | null;
  consignee_pin?: string | null;
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
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  fileName: string;
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

export interface EpodUploadRouteState {
  selectedShipments: EpodSelectedShipment[];
  uploadMode?: 'selection' | 'bulk';
}
