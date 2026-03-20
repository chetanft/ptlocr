import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createWorkflow } from '../_lib/epodWorkflowStore.ts';

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
    const result = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!result || !Array.isArray(result.items)) {
      return res.status(400).json({ error: 'Invalid workflow payload' });
    }
    return res.status(200).json(createWorkflow(result));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create workflow batch';
    return res.status(500).json({ error: message });
  }
}
