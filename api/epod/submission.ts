import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSubmissionJob } from '../_lib/epodWorkflowStore.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const batchId = body?.batchId || body?.workflowBatchId;
    if (!batchId || typeof batchId !== 'string') {
      return res.status(400).json({ error: 'batchId is required' });
    }

    const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id: unknown) => typeof id === 'string') : null;

    return res.status(200).json(
      createSubmissionJob({
        batchId,
        source: body?.source ?? null,
        createdBy: body?.createdBy ?? body?.actor ?? null,
        itemIds,
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/Workflow batch not found/i.test(message)) {
      return res.status(404).json({ error: 'Workflow batch not found' });
    }
    return res.status(500).json({ error: message || 'Failed to create submission job' });
  }
}
