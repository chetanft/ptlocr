import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IncomingForm } from 'formidable';
import { readFileSync, unlinkSync } from 'fs';
import type { OcrProvider } from '../_lib/openaiOcr.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function loadProcessEpodBatch() {
  const module = await import('../_lib/epodProcess.js');
  const processEpodBatch =
    (module as { processEpodBatch?: typeof import('../_lib/epodProcess.ts').processEpodBatch }).processEpodBatch ??
    (module as { default?: { processEpodBatch?: typeof import('../_lib/epodProcess.ts').processEpodBatch } }).default?.processEpodBatch;

  if (!processEpodBatch) {
    throw new Error('Failed to load processEpodBatch from epodProcess runtime module');
  }

  return processEpodBatch;
}

function parseMultipart(req: VercelRequest): Promise<{
  files: Array<{ buffer: Buffer; name: string }>;
  selectedAwbs: string[];
  source: string;
  actor: string;
}> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024,
      keepExtensions: true,
    });

    form.parse(req, (err: Error | null, fields: Record<string, string | string[]>, files: Record<string, unknown>) => {
      if (err) {
        console.error('Formidable parse error:', err);
        return reject(new Error('File upload parsing failed: ' + err.message));
      }

      try {
        // Handle formidable v3 file format (can be array or single object)
        const rawFiles = files.files || files.file || [];
        const fileArray = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
        const buffers: Array<{ buffer: Buffer; name: string }> = [];

        for (const f of fileArray) {
          if (!f || !f.filepath) continue;
          const buf = readFileSync(f.filepath);
          buffers.push({
            buffer: buf,
            name: f.originalFilename || f.newFilename || 'unknown',
          });
          try { unlinkSync(f.filepath); } catch {
            // Ignore temp-file cleanup failures.
          }
        }

        // Parse fields (formidable v3 wraps values in arrays)
        const getField = (key: string): string => {
          const val = fields[key];
          if (!val) return '';
          return Array.isArray(val) ? val[0] : String(val);
        };

        let selectedAwbs: string[] = [];
        const rawAwbs = getField('selectedAwbs');
        if (rawAwbs) {
          try { selectedAwbs = JSON.parse(rawAwbs) as string[]; } catch {
            // Ignore invalid selectedAwbs payloads and continue with an empty list.
          }
        }

        resolve({
          files: buffers,
          selectedAwbs,
          source: getField('source') || 'TRANSPORTER_PORTAL',
          actor: getField('actor') || 'unknown',
        });
      } catch (parseErr: unknown) {
        const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
        reject(new Error('Failed to process uploaded files: ' + message));
      }
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider: OcrProvider = process.env.GEMINI_API_KEY ? 'gemini' : 'openai';
  const apiKey = provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No OCR provider API key configured on server' });
  }

  try {
    const processEpodBatch = await loadProcessEpodBatch();
    const { files, selectedAwbs, source, actor } = await parseMultipart(req);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files received. Make sure files are sent as form field named "files".' });
    }

    console.log(`Processing ${files.length} file(s) | provider=${provider} | actor=${actor} | source=${source} | selectedAwbs=${selectedAwbs.length}`);

    const result = await processEpodBatch(
      files,
      selectedAwbs.length > 0 ? selectedAwbs : null,
      apiKey,
      provider,
    );

    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ePOD process error:', message);
    return res.status(500).json({
      error: message || 'Processing failed',
      details: process.env.NODE_ENV !== 'production' ? String(error) : undefined,
    });
  }
}
