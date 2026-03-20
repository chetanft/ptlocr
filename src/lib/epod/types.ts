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

export type EpodProcessingFilter = 'all' | 'matched' | 'needsReview' | 'skipped' | 'unmapped';

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
