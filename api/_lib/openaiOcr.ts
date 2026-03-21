import OpenAI from 'openai';

const EPOD_OCR_PROMPT = `You are analyzing a Proof of Delivery (POD) / consignment note image. Extract the following as JSON:

{
  "awb_number": "Air Waybill / docket / consignment / waybill number",
  "transporter_name": "Transport company name",
  "consignor_name": "Sender name",
  "consignor_address": "Sender full address",
  "consignor_phone": "Sender phone number or null",
  "consignor_pin": "Sender PIN/postal code or null",
  "gst_number_consignor": "Sender GST number or null",
  "consignee_name": "Receiver name",
  "consignee_address": "Receiver full address",
  "consignee_phone": "Receiver phone number or null",
  "consignee_pin": "Receiver PIN/postal code or null",
  "gst_number_consignee": "Receiver GST number or null",
  "from_city": "Origin city",
  "to_city": "Destination city",
  "delivery_date": "YYYY-MM-DD or null",
  "booking_date": "YYYY-MM-DD or null",
  "booking_branch": "Booking branch/location code or null",
  "receiver_name": "Person who received",
  "stamp_present": true/false,
  "signature_present": true/false,
  "no_of_packages": number or null,
  "weight_kg": number or null,
  "description": "Item description",
  "invoice_number": "Invoice number or null",
  "invoice_value": number or null,
  "number_of_invoices": number or null,
  "freight_mode": "Road/Surface/Air/etc or null",
  "freight_amount": "Freight amount or null",
  "remarks": "Any remarks/damage/shortage notes",
  "condition_notes": "Condition of goods",
  "payment_mode": "PAID/TO PAY/CREDIT/COD or null",
  "ewaybill_number": "E-way bill number or null",
  "dimensions": "Dimensions text or null",
  "receiver_name_stamp": "Receiver name / stamp text or null",
  "receiver_phone": "Receiver phone or null",
  "vehicle_number": "Vehicle number or null",
  "pod_copy_type": "P.O.D. copy type or null"
}

Be thorough. Use null for fields not visible.`;

export interface EpodOcrResult {
  awb_number: string | null;
  transporter_name: string | null;
  consignor_name: string | null;
  consignor_address: string | null;
  consignor_phone?: string | null;
  consignor_pin?: string | null;
  gst_number_consignor?: string | null;
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_phone?: string | null;
  consignee_pin?: string | null;
  gst_number_consignee?: string | null;
  from_city: string | null;
  to_city: string | null;
  delivery_date: string | null;
  booking_date: string | null;
  booking_branch?: string | null;
  receiver_name: string | null;
  stamp_present: boolean;
  signature_present: boolean;
  no_of_packages: number | null;
  weight_kg: number | null;
  description: string | null;
  invoice_number: string | null;
  invoice_value: number | null;
  number_of_invoices?: number | null;
  freight_mode?: string | null;
  freight_amount?: string | number | null;
  remarks: string | null;
  condition_notes: string | null;
  payment_mode: string | null;
  ewaybill_number?: string | null;
  dimensions?: string | null;
  receiver_name_stamp?: string | null;
  receiver_phone?: string | null;
  vehicle_number?: string | null;
  pod_copy_type?: string | null;
}

export type OcrProvider = 'gemini' | 'openai';

function getEmptyResult(): EpodOcrResult {
  return {
    awb_number: null,
    transporter_name: null,
    consignor_name: null,
    consignor_address: null,
    consignor_phone: null,
    consignor_pin: null,
    gst_number_consignor: null,
    consignee_name: null,
    consignee_address: null,
    consignee_phone: null,
    consignee_pin: null,
    gst_number_consignee: null,
    from_city: null,
    to_city: null,
    delivery_date: null,
    booking_date: null,
    booking_branch: null,
    receiver_name: null,
    stamp_present: false,
    signature_present: false,
    no_of_packages: null,
    weight_kg: null,
    description: null,
    invoice_number: null,
    invoice_value: null,
    number_of_invoices: null,
    freight_mode: null,
    freight_amount: null,
    remarks: null,
    condition_notes: null,
    payment_mode: null,
    ewaybill_number: null,
    dimensions: null,
    receiver_name_stamp: null,
    receiver_phone: null,
    vehicle_number: null,
    pod_copy_type: null,
  };
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function calculateConfidence(parsed: EpodOcrResult): number {
  let score = 0;
  const total = 5;
  if (parsed.awb_number) score++;
  if (parsed.consignee_name) score++;
  if (typeof parsed.stamp_present === 'boolean') score++;
  if (typeof parsed.signature_present === 'boolean') score++;
  if (parsed.to_city || parsed.consignee_address) score++;
  return score / total;
}

async function extractWithOpenAI(
  dataUrl: string,
  apiKey: string,
): Promise<{ result: EpodOcrResult; confidence: number }> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EPOD_OCR_PROMPT + '\n\nReturn strictly valid JSON only. No markdown.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(content) as EpodOcrResult;
  return { result: parsed, confidence: calculateConfidence(parsed) };
}

async function extractWithGemini(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<{ result: EpodOcrResult; confidence: number }> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${EPOD_OCR_PROMPT}\n\nReturn strictly valid JSON only. No markdown.` },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini OCR request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!content) throw new Error('Empty Gemini response');

  const parsed = JSON.parse(content) as EpodOcrResult;
  return { result: parsed, confidence: calculateConfidence(parsed) };
}

export async function extractFieldsFromFile(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string,
  provider: OcrProvider = 'openai',
): Promise<{ result: EpodOcrResult; confidence: number }> {
  const base64 = fileBuffer.toString('base64');
  const mimeType = getMimeType(fileName);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return provider === 'gemini'
    ? extractWithGemini(base64, mimeType, apiKey)
    : extractWithOpenAI(dataUrl, apiKey);
}
