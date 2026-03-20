import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { processEpodFiles, type EpodProcessResult } from '@/lib/epodApi';

interface UseEpodProcessInput {
  files: File[];
  selectedAwbs: string[];
  source?: string;
  actor?: string;
}

export function useEpodProcess() {
  const [progress, setProgress] = useState({ completed: 0, total: 0, stage: 0 });

  const processMutation = useMutation<EpodProcessResult, Error, UseEpodProcessInput>({
    mutationFn: ({ files, selectedAwbs, source, actor }) =>
      processEpodFiles(files, selectedAwbs, source, actor, (completed, total, stage) => {
        setProgress((prev) => ({
          completed,
          total,
          // Never go backwards within the same file cycle
          stage: completed > prev.completed ? stage : Math.max(prev.stage, stage),
        }));
      }),
    onMutate: () => {
      setProgress({ completed: 0, total: 0, stage: 0 });
    },
  });

  return {
    process: processMutation.mutate,
    processAsync: processMutation.mutateAsync,
    result: processMutation.data ?? null,
    isProcessing: processMutation.isPending,
    error: processMutation.error?.message ?? null,
    reset: processMutation.reset,
    progress,
  };
}
