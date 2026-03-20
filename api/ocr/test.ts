// Vercel Serverless Function for OCR Testing (Sandbox)
import OpenAI from 'openai';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const overridePrompt = formData.get('overridePrompt') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing API Key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64}`;

    const defaultPrompt = `Extract all relevant data from this document as structured JSON. 
Include fields like: shipment ID, sender/receiver details, addresses, dates, weights, tracking numbers, and any line items.`;
    
    // Always append JSON instruction to satisfy OpenAI's requirement for json_object response format
    const basePrompt = overridePrompt || defaultPrompt;
    const prompt = `${basePrompt}\n\nIMPORTANT: Return the response as valid JSON only. No markdown, no code blocks, just raw JSON.`;

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = completion.choices[0].message.content;

    let rawOcrOutput;
    try {
      rawOcrOutput = JSON.parse(result || '{}');
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Failed to parse LLM response as JSON', 
        raw: result 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ rawOcrOutput }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('OCR Test Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

