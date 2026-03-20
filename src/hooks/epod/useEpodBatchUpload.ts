import { useMutation } from '@tanstack/react-query';
import { createEpodBatch, uploadEpodBatchFiles } from '@/lib/podApi';

export function useEpodBatchUpload() {
  const createBatchMutation = useMutation({
    mutationFn: createEpodBatch,
  });

  const uploadFilesMutation = useMutation({
    mutationFn: ({
      batchId,
      files,
      source,
      uploadedBy,
    }: {
      batchId: string;
      files: File[];
      source?: string;
      uploadedBy?: string;
    }) => uploadEpodBatchFiles(batchId, files, { source, uploadedBy }),
  });

  return {
    createBatchMutation,
    uploadFilesMutation,
  };
}
