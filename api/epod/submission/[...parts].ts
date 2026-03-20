import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cancelSubmissionJob,
  getSubmissionJob,
  resubmitSubmissionJob,
} from '../../_lib/epodWorkflowStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const parts = Array.isArray(req.query.parts)
    ? req.query.parts
    : typeof req.query.parts === 'string'
      ? req.query.parts.split('/')
      : [];
  const jobId = parts[0];
  const action = parts[1];

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  try {
    if (req.method === 'GET' && !action) {
      const job = getSubmissionJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Submission job not found' });
      }
      return res.status(200).json(job);
    }

    if (req.method === 'POST' && action === 'resubmit') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id: unknown) => typeof id === 'string') : null;
      return res.status(200).json(
        resubmitSubmissionJob({
          jobId,
          itemIds,
        }),
      );
    }

    if (req.method === 'POST' && action === 'cancel') {
      return res.status(200).json(cancelSubmissionJob(jobId));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/Submission job not found/i.test(message)) {
      return res.status(404).json({ error: 'Submission job not found' });
    }
    if (/Workflow batch not found/i.test(message)) {
      return res.status(404).json({ error: 'Workflow batch not found' });
    }
    return res.status(500).json({ error: message || 'Submission job operation failed' });
  }
}
