export const EPOD_REVIEW_BUCKETS = {
  READY: 'READY_TO_SUBMIT',
  REVIEW: 'NEEDS_REVIEW',
  BLOCKED: 'BLOCKED',
  UNMAPPED: 'UNMAPPED_IMAGES',
  SUBMITTED: 'SUBMITTED_TO_CONSIGNOR',
} as const;

export const EPOD_PROCESSING_STEPS = [
  'Running OCR extraction',
  'Matching with selected AWBs',
  'Checking duplicates and exceptions',
  'Preparing review buckets',
] as const;
