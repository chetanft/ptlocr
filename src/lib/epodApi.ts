import type { ProcessedItem } from '../../api/_lib/epodProcess';

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

export async function processEpodFiles(
  files: File[],
  selectedAwbs: string[],
  source: string = 'TRANSPORTER_PORTAL',
  actor: string = 'transporter',
): Promise<EpodProcessResult> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('selectedAwbs', JSON.stringify(selectedAwbs));
  formData.append('source', source);
  formData.append('actor', actor);

  const res = await fetch('/api/epod/process', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Processing failed');
  }

  return res.json();
}
