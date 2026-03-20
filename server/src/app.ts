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

// ePOD Batch APIs
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
