import OpenAI from 'openai';

export const config = {
    runtime: 'edge', // Or 'nodejs' if needed, but 'edge' is faster for simple proxying
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const { image, prompt } = await req.json();

        if (!image) {
            return new Response(JSON.stringify({ error: 'Image is required' }), { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error: Missing API Key' }), { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        // Handle base64 image
        // Ensure image string includes data URI scheme or is just the base64 part
        // OpenAI expects "data:image/jpeg;base64,{base64_image}"
        const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

        // Ensure prompt contains "JSON" to satisfy OpenAI's json_object response format requirement
        const fullPrompt = `${prompt || 'Extract all data from this document.'}\n\nIMPORTANT: Return the response as valid JSON only. No markdown, no code blocks, just raw JSON object.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: fullPrompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
        });

        const result = completion.choices[0].message.content;

        // Parse to ensure validity before returning, or return raw and let frontend handle
        let parsedResult;
        try {
            parsedResult = JSON.parse(result || '{}');
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Failed to parse LLM response as JSON', raw: result }), { status: 502 });
        }

        return new Response(JSON.stringify(parsedResult), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error: any) {
        console.error('OCR Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
}
