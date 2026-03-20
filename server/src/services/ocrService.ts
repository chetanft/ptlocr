import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const ocrService = {
    async processDocumentWithOpenAI(filePath: string, prompt: string) {
        // Read file as base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = fileBuffer.toString('base64');

        // Detect simplistic mime type from file extension or magic bytes (simplified here)
        // We really should pass the mimetype from the controller (multer gives it)
        // But for now, let's try to infer or just match extension.
        // Actually, let's update the signature to accept mimetype if possible?
        // Changing signature requires updating controller. 
        // Let's stick to simple detection or generic 'image/jpeg' if unknown, but better:

        const ext = filePath.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        if (ext === 'webp') mimeType = 'image/webp';
        if (ext === 'gif') mimeType = 'image/gif';

        // If PDF, we can't just send it as image_url easily without conversion.
        // We will assume it's an image for now.

        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt + "\n\nReturn strictly valid JSON only. No markdown." },
                            {
                                type: "image_url",
                                image_url: { url: dataUrl }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            });

            console.log("OpenAI Status:", response.choices[0].finish_reason);
            const message = response.choices[0].message;

            // Check for refusal (Safety guardrails)
            if (message.refusal) {
                console.error("OpenAI Refusal:", message.refusal);
                throw new Error(`OpenAI Refused to process this image: ${message.refusal}`);
            }

            const content = message.content;

            if (!content) {
                console.error("OpenAI Response Empty:", JSON.stringify(response, null, 2));
                throw new Error(`No content from OpenAI. Reason: ${response.choices[0].finish_reason}`);
            }

            return JSON.parse(content);
        } catch (e: any) {
            console.error("OpenAI Call Failed:", e.response?.data || e.message);
            throw e;
        }
    },

    // Helper to read property by dot notation path e.g. "$.header.invoiceDate" or "header.invoiceDate"
    getValueByPath(obj: any, path: string) {
        if (!path) return undefined;

        // Remove leading $. if present
        const cleanPath = path.startsWith('$.') ? path.substring(2) : path;
        const parts = cleanPath.split('.');

        let current = obj;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    },

    applyMappings(rawJson: any, mappings: any[]) {
        // mappings: [{ fieldKey, jsonPath, transform, mandatory }]
        const structuredPayload: Record<string, any> = {};
        const missingFields: string[] = [];
        const mappingUsed: any[] = [];

        for (const mapping of mappings) {
            const { fieldKey, jsonPath, mandatory, transform } = mapping;
            let value = this.getValueByPath(rawJson, jsonPath);

            // Apply transforms
            if (value !== undefined && value !== null) {
                if (transform === 'UPPERCASE') value = String(value).toUpperCase();
                if (transform === 'TRIM') value = String(value).trim();
                if (transform === 'NUMBER') value = parseFloat(String(value));
                // Date parsing could go here
            }

            if (mandatory && (value === undefined || value === null || value === '')) {
                missingFields.push(fieldKey);
            }

            if (value !== undefined) {
                structuredPayload[fieldKey] = value;
            }

            mappingUsed.push({ fieldKey, jsonPath, found: value !== undefined });
        }

        return { structuredPayload, missingFields, mappingUsed };
    }
};
