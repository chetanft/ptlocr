export interface ProcessedItem {
  id: string;
  fileName: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  consigneeName: string | null;
  statusLabel: 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
  statusVariant: 'success' | 'warning' | 'danger' | 'secondary';
  reason: string;
  confidence: number;
  confidenceLabel: string;
  stampPresent: boolean;
  signaturePresent: boolean;
  ocrFields: Record<string, unknown>;
}

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

/**
 * Process a single file against the ePOD API.
 * Sends one file at a time to stay under Vercel's 4.5MB body limit.
 */
async function processSingleFile(
  file: File,
  selectedAwbs: string[],
  source: string,
  actor: string,
): Promise<EpodProcessResult> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('selectedAwbs', JSON.stringify(selectedAwbs));
  formData.append('source', source);
  formData.append('actor', actor);

  const res = await fetch('/api/epod/process', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Processing failed for ${file.name}`);
  }

  return res.json();
}

/**
 * Process multiple ePOD files by sending them one at a time
 * and aggregating the results. This avoids Vercel's 4.5MB body limit.
 */
export async function processEpodFiles(
  files: File[],
  selectedAwbs: string[],
  source: string = 'TRANSPORTER_PORTAL',
  actor: string = 'transporter',
  onProgress?: (completed: number, total: number) => void,
): Promise<EpodProcessResult> {
  const allItems: ProcessedItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await processSingleFile(files[i], selectedAwbs, source, actor);
    allItems.push(...result.items);
    onProgress?.(i + 1, files.length);
  }

  // Aggregate summary
  const summary = {
    totalAwbs: selectedAwbs.length || allItems.length,
    totalUploadedImages: files.length,
    matchedCount: allItems.filter(i => i.statusLabel === 'Matched').length,
    needsReviewCount: allItems.filter(i => i.statusLabel === 'Needs Review').length,
    skippedCount: allItems.filter(i => i.statusLabel === 'Skipped').length,
    unmappedCount: allItems.filter(i => i.statusLabel === 'Unmapped').length,
  };

  return { summary, items: allItems };
}
