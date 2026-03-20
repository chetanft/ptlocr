import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  return res.status(410).json({
    error: 'Submission workflow API is disabled on Vercel. Use the browser-local ePOD workflow instead.',
    path: parts,
  });
}
