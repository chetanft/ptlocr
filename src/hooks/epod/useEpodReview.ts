import { useMemo } from 'react';
import { groupBatchItems } from '@/lib/epod/selectors';
import type { EpodBatchItem } from '@/lib/epod/types';

export function useEpodReview(items: EpodBatchItem[]) {
  return useMemo(() => groupBatchItems(items), [items]);
}
