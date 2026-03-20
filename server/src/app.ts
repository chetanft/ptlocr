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
import { epodWorkflowStore } from './services/epodWorkflowStore';
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
        const uploadedFiles = (req.files as Express.Multer.File[]) || [];
        if (uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const selectedAwbs: string[] = req.body.selectedAwbs ? JSON.parse(req.body.selectedAwbs) : [];
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
        }

        const { readFileSync, unlinkSync } = await import('fs');
        const { ocrService } = await import('./services/ocrService');
        const shipmentPath = path.resolve(__dirname, '../../src/data/epodExtractedShipments.json');
        let shipmentMaster: any[] = [];
        try {
            shipmentMaster = JSON.parse(readFileSync(shipmentPath, 'utf8'));
        } catch {}

        const normalizeAwb = (awb: string) => awb.replace(/[\s\-_.]/g, '').toUpperCase();
        const findShipment = (awb: string) => shipmentMaster.find((shipment) => normalizeAwb(shipment.awbNumber) === normalizeAwb(awb));
        const getConfidenceLabel = (confidence: number) => {
            if (confidence >= 0.8) return 'High';
            if (confidence >= 0.5) return 'Medium';
            return 'Low';
        };

        const items: any[] = [];

        for (const [index, file] of uploadedFiles.entries()) {
            let ocrFields: any = {
                awb_number: null,
                consignee_name: null,
                consignor_name: null,
                from_city: null,
                to_city: null,
                stamp_present: false,
                signature_present: false,
                no_of_packages: null,
                description: null,
                invoice_number: null,
                remarks: null,
                condition_notes: null,
            };
            let confidence = 0;

            try {
                const prompt = 'Extract as JSON: awb_number, consignee_name, consignor_name, from_city, to_city, delivery_date, stamp_present, signature_present, no_of_packages, description, invoice_number, remarks, condition_notes. Return valid JSON only.';
                ocrFields = await ocrService.processDocumentWithOpenAI(file.path, prompt);
                const score = [
                    Boolean(ocrFields.awb_number),
                    Boolean(ocrFields.consignee_name),
                    typeof ocrFields.stamp_present === 'boolean',
                    typeof ocrFields.signature_present === 'boolean',
                    Boolean(ocrFields.to_city),
                ].filter(Boolean).length;
                confidence = score / 5;
            } catch (error) {
                console.error('OCR failed for', file.originalname, error);
            } finally {
                try { unlinkSync(file.path); } catch {}
            }

            const shipment = ocrFields.awb_number ? findShipment(ocrFields.awb_number) : null;
            const missingSystemFields = shipment
                ? [
                    !shipment.shipmentId && 'shipment id',
                    !shipment.origin && 'from',
                    !shipment.consigneeName && 'to name',
                    !shipment.destination && 'to city',
                    !shipment.transporter && 'transporter',
                ].filter(Boolean)
                : [];

            let statusLabel: 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped' = 'Unmapped';
            let statusVariant: 'success' | 'warning' | 'danger' | 'secondary' = 'secondary';
            let reason = 'No AWB detected in image';

            if (!ocrFields.awb_number) {
                reason = 'No AWB detected in image';
            } else if (!shipment) {
                reason = `AWB ${ocrFields.awb_number} not found in shipment master`;
            } else if (selectedAwbs.length > 0 && !selectedAwbs.map(normalizeAwb).includes(normalizeAwb(ocrFields.awb_number))) {
                statusLabel = 'Skipped';
                statusVariant = 'danger';
                reason = `AWB ${ocrFields.awb_number} not in selected scope`;
            } else if (confidence < 0.4) {
                statusLabel = 'Needs Review';
                statusVariant = 'warning';
                reason = 'Low OCR confidence — manual verification needed';
            } else if (missingSystemFields.length > 0) {
                statusLabel = 'Needs Review';
                statusVariant = 'warning';
                reason = `Incomplete shipment data: missing ${missingSystemFields.join(', ')}`;
            } else if (!ocrFields.stamp_present || !ocrFields.signature_present) {
                statusLabel = 'Needs Review';
                statusVariant = 'warning';
                reason = `Missing ${[!ocrFields.stamp_present && 'stamp', !ocrFields.signature_present && 'signature'].filter(Boolean).join(' and ')}`;
            } else if (`${ocrFields.remarks || ''} ${ocrFields.condition_notes || ''}`.match(/damage|broken|torn|wet|crushed|short|shortage/i)) {
                statusLabel = 'Needs Review';
                statusVariant = 'warning';
                reason = 'Damage or shortage noted in remarks';
            } else {
                statusLabel = 'Matched';
                statusVariant = 'success';
                reason = 'AWB matched, all validations passed';
            }

            const sentQty = shipment?.packageCount ?? ocrFields.no_of_packages ?? 0;
            const receivedQty = ocrFields.no_of_packages ?? sentQty;
            const damagedQty = /damage|broken|torn|wet|crushed/i.test(`${ocrFields.remarks || ''} ${ocrFields.condition_notes || ''}`) ? 1 : 0;
            const difference = receivedQty - sentQty;
            const reconStatus = damagedQty > 0 ? 'DAMAGED' : difference < 0 ? 'SHORT' : difference > 0 ? 'EXCESS' : 'MATCH';

            items.push({
                id: `item-${index}-${Date.now()}`,
                processingMode: 'bulk',
                bucket: statusLabel === 'Matched' ? 'matched' : statusLabel === 'Needs Review' ? 'needs_review' : statusLabel === 'Skipped' ? 'skipped' : 'unmapped',
                fileName: file.originalname,
                awbNumber: ocrFields.awb_number ?? null,
                shipmentId: shipment?.shipmentId ?? null,
                fromName: shipment?.origin ?? ocrFields.consignor_name ?? null,
                fromSubtext: shipment?.originCity ?? ocrFields.from_city ?? null,
                toName: shipment?.consigneeName ?? ocrFields.consignee_name ?? null,
                toSubtext: shipment?.destination ?? ocrFields.to_city ?? null,
                transporter: shipment?.transporter ?? null,
                consigneeName: ocrFields.consignee_name ?? shipment?.consigneeName ?? null,
                statusLabel,
                statusVariant,
                reason,
                confidence,
                confidenceLabel: getConfidenceLabel(confidence),
                stampPresent: Boolean(ocrFields.stamp_present),
                signaturePresent: Boolean(ocrFields.signature_present),
                invoiceNumberExtracted: ocrFields.invoice_number ?? null,
                invoiceNumberSystem: shipment ? `INV-${shipment.awbNumber}` : null,
                sentQty,
                receivedQty,
                difference,
                deliveryReviewStatus: null,
                systemData: {
                    awbNumber: shipment?.awbNumber ?? null,
                    shipmentId: shipment?.shipmentId ?? null,
                    fromName: shipment?.origin ?? null,
                    fromSubtext: shipment?.originCity ?? null,
                    toName: shipment?.consigneeName ?? null,
                    toSubtext: shipment?.destination ?? null,
                    transporter: shipment?.transporter ?? null,
                    deliveredDate: shipment?.deliveredDate ?? null,
                    packages: shipment?.packageCount ?? null,
                },
                ocrData: {
                    extractedAwb: ocrFields.awb_number ?? null,
                    extractedConsignee: ocrFields.consignee_name ?? null,
                    extractedDeliveryDate: ocrFields.delivery_date ?? null,
                    extractedFrom: ocrFields.consignor_name ?? ocrFields.from_city ?? null,
                    extractedTo: ocrFields.consignee_name ?? ocrFields.to_city ?? null,
                    stampPresent: Boolean(ocrFields.stamp_present),
                    signaturePresent: Boolean(ocrFields.signature_present),
                    remarks: ocrFields.remarks ?? null,
                    conditionNotes: ocrFields.condition_notes ?? null,
                    description: ocrFields.description ?? null,
                    packages: ocrFields.no_of_packages ?? null,
                    rawFields: ocrFields,
                },
                lineItems: [{
                    id: `${file.originalname}-line-1`,
                    sku: ocrFields.invoice_number ?? shipment?.shipmentId ?? null,
                    description: ocrFields.description || 'POD package line',
                    sentQty,
                    receivedQty,
                    damagedQty,
                    difference,
                    reconStatus,
                }],
                exceptions: [],
                auditTrail: [
                    { id: `${file.originalname}-audit-upload`, timestamp: new Date().toISOString(), actor: String(req.body.actor || 'system'), description: 'File uploaded for ePOD processing' },
                    { id: `${file.originalname}-audit-ocr`, timestamp: new Date().toISOString(), actor: 'system', description: 'OCR extraction completed' },
                ],
                ocrFields,
            });
        }

        const totalAwbs = new Set(
            items.filter((item) => item.statusLabel !== 'Unmapped' && item.awbNumber).map((item) => normalizeAwb(String(item.awbNumber)))
        ).size;

        return res.json({
            summary: {
                totalAwbs,
                totalUploadedImages: uploadedFiles.length,
                matchedCount: items.filter((item) => item.statusLabel === 'Matched').length,
                needsReviewCount: items.filter((item) => item.statusLabel === 'Needs Review').length,
                skippedCount: items.filter((item) => item.statusLabel === 'Skipped').length,
                unmappedCount: items.filter((item) => item.statusLabel === 'Unmapped').length,
            },
            items,
        });
    } catch (error: any) {
        console.error('ePOD process error:', error);
        res.status(500).json({ error: error.message || 'Processing failed' });
    }
});

app.post('/api/epod/workflow', (req, res) => {
    try {
        if (!req.body || !Array.isArray(req.body.items)) {
            return res.status(400).json({ error: 'Invalid workflow payload' });
        }
        return res.json(epodWorkflowStore.create(req.body));
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to create workflow batch' });
    }
});

app.post('/api/epod/workflow/action', (req, res) => {
    try {
        return res.json(epodWorkflowStore.applyAction(req.body));
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to update workflow batch' });
    }
});

// Start
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});

void mockShipmentSeedService.ensureSeeded().then((count) => {
    console.log(`Mock shipment seed ready: ${count} AWBs`);
}).catch((error) => {
    console.error('Failed to seed mock shipments', error);
});
