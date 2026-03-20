import express from 'express';
import cors from 'cors';
import { urlencoded, json } from 'body-parser';
import dotenv from 'dotenv';
import apiHandler from './api/analyze';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(json({ limit: '10mb' })); // Increase limit for images
app.use(urlencoded({ extended: true, limit: '10mb' }));

// Mock Request object for Vercel function
const adaptRequest = (req: any): Request => {
    return {
        method: req.method,
        json: async () => req.body,
        headers: req.headers as any,
    } as unknown as Request;
};

app.post('/api/analyze', async (req, res) => {
    try {
        const response = await apiHandler(adaptRequest(req));

        // Convert Web Response to Express Response
        const data = await response.text();
        res.status(response.status).set(Object.fromEntries(response.headers)).send(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: (error as Error).message || String(error) });
    }
});

app.listen(port, () => {
    console.log(`Local API server running on http://localhost:${port}`);
});
