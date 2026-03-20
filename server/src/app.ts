import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env before other imports might use it
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // It might be in server/ root, check paths

import { ocrController } from './controllers/ocrController';
import { podController } from './controllers/podController';
import { epodBatchController } from './controllers/epodBatchController';
import { mockShipmentSeedService } from './services/mockShipmentSeedService';

const app = express();
const port = process.env.PORT || 3001; // Default to 3001 to avoid React conflict

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File Upload
const uploadDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Static file serving for POD images
app.use('/uploads', express.static(uploadDir));

// Routes
app.get('/health', (req, res) => res.send('OCR Service Backend is Healthy'));

// Config APIs
app.get('/api/ocr/config', (req, res) => ocrController.getConfig(req, res));
app.post('/api/ocr/config', (req, res) => ocrController.saveConfig(req, res));
app.get('/api/ocr/configs', (req, res) => ocrController.listConfigs(req, res));

// OCR APIs
app.post('/api/ocr/test', upload.single('file'), (req, res) => ocrController.runTest(req, res));
app.post('/api/ocr/process-document', upload.single('file'), (req, res) => ocrController.processDocument(req, res));

// POD Upload APIs
app.post('/api/pod/upload', upload.single('file'), (req, res) => podController.uploadSingle(req, res));
app.post('/api/pod/upload-bulk', upload.array('files', 50), (req, res) => podController.uploadBulk(req, res));
app.get('/api/pod/list', (req, res) => podController.listPods(req, res));
app.get('/api/pod/stats/summary', (req, res) => podController.getStats(req, res));
app.get('/api/pod/approvals/pending', (req, res) => podController.getPendingApprovals(req, res));
app.get('/api/pod/:id', (req, res) => podController.getPodDetail(req, res));

// POD Processing APIs
app.post('/api/pod/:id/process', (req, res) => podController.processOcr(req, res));
app.post('/api/pod/process-batch', (req, res) => podController.processBatch(req, res));

// POD Reconciliation APIs
app.post('/api/pod/:id/reconcile', (req, res) => podController.reconcile(req, res));
app.get('/api/pod/:id/recon', (req, res) => podController.getReconResults(req, res));

// POD Review & Approval APIs
app.post('/api/pod/:id/line/:lineId/review', (req, res) => podController.reviewLine(req, res));
app.post('/api/pod/:id/exception/:exId/resolve', (req, res) => podController.resolveException(req, res));
app.post('/api/pod/:id/approve', (req, res) => podController.approvePod(req, res));
app.post('/api/pod/:id/reject', (req, res) => podController.rejectPod(req, res));

// Shipment Master Data APIs
app.get('/api/shipments', (req, res) => podController.listShipments(req, res));
app.post('/api/shipments', (req, res) => podController.createShipment(req, res));
app.post('/api/shipments/bulk', (req, res) => podController.bulkCreateShipments(req, res));

// ePOD Serverless-compatible one-shot process endpoint (for local dev)
app.post('/api/epod/process', upload.array('files', 50), async (req, res) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const selectedAwbs: string[] = req.body.selectedAwbs ? JSON.parse(req.body.selectedAwbs) : [];
        const apiKey = process.env.OPENAI_API_KEY;

        // Import processing utilities
        const fs = await import('fs');
        const { ocrService } = await import('./services/ocrService');

        // Load shipment master from frontend data
        const shipmentPath = path.resolve(__dirname, '../../src/data/epodExtractedShipments.json');
        let shipmentMaster: any[] = [];
        try { shipmentMaster = JSON.parse(fs.readFileSync(shipmentPath, 'utf8')); } catch {}

        const normalizeAwb = (awb: string) => awb.replace(/[\s\-_.]/g, '').toUpperCase();
        const findShipment = (awb: string) => shipmentMaster.find(s => normalizeAwb(s.awbNumber) === normalizeAwb(awb));
        const findByFileName = (name: string) => shipmentMaster.find(s => s.fileName === name);

        const items: any[] = [];
        for (const file of files) {
            let ocrFields: any = {};
            let confidence = 0.1;

            if (apiKey && apiKey !== 'your-openai-api-key-here') {
                try {
                    const prompt = `Extract from this POD image as JSON: awb_number, consignee_name, consignor_name, from_city, to_city, stamp_present (bool), signature_present (bool), no_of_packages, weight_kg, remarks, condition_notes. Return valid JSON only.`;
                    ocrFields = await ocrService.processDocumentWithOpenAI(file.path, prompt);
                    confidence = 0.8;
                } catch (e) { console.error('OCR failed for', file.originalname, e); }
            }

            // Fallback: extract AWB from filename
            if (!ocrFields.awb_number) {
                ocrFields.awb_number = file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '');
            }

            const matched = ocrFields.awb_number ? findShipment(ocrFields.awb_number) : null;
            const matchedByFile = !matched ? findByFileName(file.originalname) : null;
            const shipment = matched || matchedByFile;

            let statusLabel = 'Unmapped';
            let statusVariant = 'secondary';
            let reason = 'No match found';

            if (shipment) {
                if (selectedAwbs.length > 0 && !selectedAwbs.map(normalizeAwb).includes(normalizeAwb(ocrFields.awb_number))) {
                    statusLabel = 'Skipped'; statusVariant = 'danger'; reason = 'AWB not in selected scope';
                } else if (!ocrFields.stamp_present || !ocrFields.signature_present) {
                    statusLabel = 'Needs Review'; statusVariant = 'warning';
                    const missing = [!ocrFields.stamp_present && 'stamp', !ocrFields.signature_present && 'signature'].filter(Boolean);
                    reason = `Missing ${missing.join(' and ')}`;
                } else {
                    statusLabel = 'Matched'; statusVariant = 'success'; reason = 'All validations passed';
                }
            }

            items.push({
                id: `item-${items.length}`,
                fileName: file.originalname,
                awbNumber: ocrFields.awb_number || shipment?.awbNumber || null,
                shipmentId: shipment?.shipmentId || null,
                fromName: shipment?.origin || ocrFields.consignor_name || null,
                fromSubtext: shipment?.originCity || ocrFields.from_city || null,
                toName: shipment?.consigneeName || ocrFields.consignee_name || null,
                toSubtext: shipment?.destination || ocrFields.to_city || null,
                transporter: shipment?.transporter || null,
                consigneeName: ocrFields.consignee_name || shipment?.consigneeName || null,
                statusLabel, statusVariant, reason, confidence,
                confidenceLabel: confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low',
                stampPresent: ocrFields.stamp_present ?? false,
                signaturePresent: ocrFields.signature_present ?? false,
                ocrFields,
            });

            // Cleanup uploaded file
            try { fs.unlinkSync(file.path); } catch {}
        }

        const summary = {
            totalAwbs: selectedAwbs.length || items.length,
            totalUploadedImages: files.length,
            matchedCount: items.filter((i: any) => i.statusLabel === 'Matched').length,
            needsReviewCount: items.filter((i: any) => i.statusLabel === 'Needs Review').length,
            skippedCount: items.filter((i: any) => i.statusLabel === 'Skipped').length,
            unmappedCount: items.filter((i: any) => i.statusLabel === 'Unmapped').length,
        };

        res.json({ summary, items });
    } catch (error: any) {
        console.error('ePOD process error:', error);
        res.status(500).json({ error: error.message || 'Processing failed' });
    }
});

// ePOD Batch APIs (legacy — kept for backward compatibility)
app.post('/api/epod/batch/create', (req, res) => epodBatchController.createBatch(req, res));
app.post('/api/epod/batch/:batchId/upload', upload.array('files', 50), (req, res) => epodBatchController.uploadBatchFiles(req, res));
app.post('/api/epod/batch/:batchId/process', (req, res) => epodBatchController.processBatch(req, res));
app.get('/api/epod/batch/:batchId', (req, res) => epodBatchController.getBatch(req, res));
app.get('/api/epod/batch/:batchId/items', (req, res) => epodBatchController.getBatchItems(req, res));
app.post('/api/epod/batch/:batchId/submit', (req, res) => epodBatchController.submitBatch(req, res));
app.post('/api/epod/batch/:batchId/cancel', (req, res) => epodBatchController.cancelBatch(req, res));

// Start
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});

void mockShipmentSeedService.ensureSeeded().then((count) => {
    console.log(`Mock shipment seed ready: ${count} AWBs`);
}).catch((error) => {
    console.error('Failed to seed mock shipments', error);
});
