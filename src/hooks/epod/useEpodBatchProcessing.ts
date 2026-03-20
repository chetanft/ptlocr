import { useMutation, useQuery } from '@tanstack/react-query';
import { cancelEpodBatch, getEpodBatch, getEpodBatchItems, processEpodBatch, submitEpodBatch } from '@/lib/podApi';

export function useEpodBatch(batchId?: string) {
  const batchQuery = useQuery({
    queryKey: ['epod-batch', batchId],
    queryFn: () => getEpodBatch(batchId!),
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'OCR_PROCESSING' || status === 'MATCHING' ? 2000 : false;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ['epod-batch-items', batchId],
    queryFn: async () => (await getEpodBatchItems(batchId!)).items,
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const batchStatus = batchQuery.data?.status;
      if (batchStatus === 'OCR_PROCESSING' || batchStatus === 'MATCHING') return 2000;
      return query.state.data ? false : 2000;
    },
  });

  const processMutation = useMutation({
    mutationFn: (targetBatchId?: string) => processEpodBatch(targetBatchId ?? batchId!),
  });

  const submitMutation = useMutation({
    mutationFn: (actedBy?: string) => submitEpodBatch(batchId!, actedBy),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelEpodBatch(batchId!),
  });

  return {
    batchQuery,
    itemsQuery,
    processMutation,
    submitMutation,
    cancelMutation,
  };
}
