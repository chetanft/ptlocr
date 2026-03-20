import type { EpodBatchItem } from './types';
import { EPOD_REVIEW_BUCKETS } from './status';

export function groupBatchItems(items: EpodBatchItem[]) {
  return {
    ready: items.filter((item) => item.reviewBucket === EPOD_REVIEW_BUCKETS.READY),
    review: items.filter((item) => item.reviewBucket === EPOD_REVIEW_BUCKETS.REVIEW),
    blocked: items.filter((item) => item.reviewBucket === EPOD_REVIEW_BUCKETS.BLOCKED),
    unmapped: items.filter((item) => item.reviewBucket === EPOD_REVIEW_BUCKETS.UNMAPPED),
    submitted: items.filter((item) => item.reviewBucket === EPOD_REVIEW_BUCKETS.SUBMITTED),
  };
}

export function getProcessingStepIndex(status?: string | null): number {
  switch (status) {
    case 'OCR_PROCESSING':
      return 0;
    case 'MATCHING':
      return 1;
    case 'REVIEW_REQUIRED':
    case 'READY_TO_SUBMIT':
      return 3;
    case 'SUBMITTED':
      return 3;
    default:
      return 0;
  }
}
