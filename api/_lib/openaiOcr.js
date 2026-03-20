"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFieldsFromFile = extractFieldsFromFile;
const openai_1 = __importDefault(require("openai"));
const EPOD_OCR_PROMPT = `You are analyzing a Proof of Delivery (POD) / consignment note image. Extract the following as JSON:

{
  "awb_number": "Air Waybill / docket / consignment / waybill number",
  "transporter_name": "Transport company name",
  "consignor_name": "Sender name",
  "consignor_address": "Sender full address",
  "consignee_name": "Receiver name",
  "consignee_address": "Receiver full address",
  "from_city": "Origin city",
  "to_city": "Destination city",
  "delivery_date": "YYYY-MM-DD or null",
  "booking_date": "YYYY-MM-DD or null",
  "receiver_name": "Person who received",
  "stamp_present": true/false,
  "signature_present": true/false,
  "no_of_packages": number or null,
  "weight_kg": number or null,
  "description": "Item description",
  "invoice_number": "Invoice number or null",
  "invoice_value": number or null,
  "remarks": "Any remarks/damage/shortage notes",
  "condition_notes": "Condition of goods",
  "payment_mode": "PAID/TO PAY/CREDIT/COD or null"
}

Be thorough. Use null for fields not visible.`;
async function extractFieldsFromFile(fileBuffer, fileName, apiKey) {
    const openai = new openai_1.default({ apiKey });
    const base64 = fileBuffer.toString('base64');
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    let mimeType = 'image/jpeg';
    if (ext === 'png')
        mimeType = 'image/png';
    if (ext === 'pdf')
        mimeType = 'application/pdf';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    try {
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
        if (!content)
            throw new Error('Empty OpenAI response');
        const parsed = JSON.parse(content);
        // Calculate confidence based on key fields presence
        let score = 0;
        let total = 5;
        if (parsed.awb_number)
            score++;
        if (parsed.consignee_name)
            score++;
        if (parsed.stamp_present !== null)
            score++;
        if (parsed.signature_present !== null)
            score++;
        if (parsed.to_city || parsed.consignee_address)
            score++;
        return { result: parsed, confidence: score / total };
    }
    catch (error) {
        console.error('OCR extraction failed:', error.message);
        return {
            result: {
                awb_number: null,
                transporter_name: null,
                consignor_name: null,
                consignor_address: null,
                consignee_name: null,
                consignee_address: null,
                from_city: null,
                to_city: null,
                delivery_date: null,
                booking_date: null,
                receiver_name: null,
                stamp_present: false,
                signature_present: false,
                no_of_packages: null,
                weight_kg: null,
                description: null,
                invoice_number: null,
                invoice_value: null,
                remarks: null,
                condition_notes: null,
                payment_mode: null,
            },
            confidence: 0,
        };
    }
}
