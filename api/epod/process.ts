import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processEpodBatch } from '../_lib/epodProcess';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
};

async function parseMultipart(req: VercelRequest): Promise<{
  files: Array<{ buffer: Buffer; name: string }>;
  selectedAwbs: string[];
  source: string;
  actor: string;
}> {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    // Use built-in formidable or manual parsing
    const { IncomingForm } = await import('formidable');
    const form = new IncomingForm({ multiples: true, maxFileSize: 50 * 1024 * 1024 });

    return new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) return reject(err);

        const fileArray = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
        const buffers: Array<{ buffer: Buffer; name: string }> = [];

        const fs = await import('fs');
        for (const f of fileArray) {
          const buf = fs.readFileSync(f.filepath);
          buffers.push({ buffer: buf, name: f.originalFilename || 'unknown' });
          // Clean up temp file
          try { fs.unlinkSync(f.filepath); } catch {}
        }

        const selectedAwbs = fields.selectedAwbs
          ? JSON.parse(Array.isArray(fields.selectedAwbs) ? fields.selectedAwbs[0] : fields.selectedAwbs)
          : [];
        const source = (Array.isArray(fields.source) ? fields.source[0] : fields.source) || 'TRANSPORTER_PORTAL';
        const actor = (Array.isArray(fields.actor) ? fields.actor[0] : fields.actor) || 'unknown';

        resolve({ files: buffers, selectedAwbs, source, actor });
      });
    });
  }

  throw new Error('Expected multipart/form-data');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const { files, selectedAwbs, source, actor } = await parseMultipart(req);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Processing ${files.length} files for actor=${actor}, source=${source}, selectedAwbs=${selectedAwbs.length}`);

    const result = await processEpodBatch(files, selectedAwbs.length > 0 ? selectedAwbs : null, apiKey);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('ePOD process error:', error);
    return res.status(500).json({ error: error.message || 'Processing failed' });
  }
}
