import { Request, Response } from 'express';
import { podService } from '../services/podService';
import { podOcrService } from '../services/podOcrService';
import { reconService } from '../services/reconService';
import { approvalService } from '../services/approvalService';
import { epodBatchService } from '../services/epodBatchService';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export const podController = {
    // POST /api/pod/upload - Single file upload
    async uploadSingle(req: Request, res: Response) {
        try {
            if (!req.file) return res.status(400).json({ error: 'File is required' });

            const { source, awbNumber, uploadedBy } = req.body;
            const upload = await podService.createUpload({
                fileName: req.file.originalname,
                filePath: req.file.path,
                source: source || 'MANUAL',
                awbNumber,
                uploadedBy,
            });

            res.json(upload);
        } catch (error: any) {
            console.error('Upload Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/upload-bulk - Bulk upload
    async uploadBulk(req: Request, res: Response) {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) return res.status(400).json({ error: 'Files are required' });

            const { source, uploadedBy } = req.body;
            const batchId = uuidv4();

            await epodBatchService.ensureBatch(batchId, { source: source || 'MANUAL', createdBy: uploadedBy });

            const uploads = await podService.createBulkUpload(
                files.map(f => ({ fileName: f.originalname, filePath: f.path })),
                { source: source || 'MANUAL', uploadedBy, batchId }
            );

            await epodBatchService.refreshBatchCounts(batchId);

            res.json({ batchId, count: uploads.length, uploads });
        } catch (error: any) {
            console.error('Bulk Upload Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/pod/list
    async listPods(req: Request, res: Response) {
        try {
            const filters = {
                status: req.query.status as string,
                awbNumber: req.query.awbNumber as string,
                batchId: req.query.batchId as string,
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
            };
            const result = await podService.listPods(filters);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/pod/stats/summary
    async getStats(req: Request, res: Response) {
        try {
            const stats = await podService.getStats();
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/pod/:id
    async getPodDetail(req: Request, res: Response) {
        try {
            const pod = await podService.getPodDetail(req.params.id);
            if (!pod) return res.status(404).json({ error: 'POD not found' });
            res.json(pod);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/process - Trigger OCR on single POD
    async processOcr(req: Request, res: Response) {
        try {
            const result = await podOcrService.processAndSave(req.params.id);
            res.json(result);
        } catch (error: any) {
            console.error('OCR Process Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/process-batch - Trigger OCR on batch
    async processBatch(req: Request, res: Response) {
        try {
            const { podIds, batchId } = req.body;
            let ids = podIds;

            // If batchId provided, find all PODs in that batch
            if (!ids && batchId) {
                const batch = await podService.listPods({ batchId, limit: 100 });
                ids = batch.items.map((p: any) => p.id);
            }

            if (!ids || ids.length === 0) return res.status(400).json({ error: 'podIds or batchId required' });

            const results = await podOcrService.processBatch(ids);
            res.json({ results });
        } catch (error: any) {
            console.error('Batch Process Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/reconcile
    async reconcile(req: Request, res: Response) {
        try {
            const result = await reconService.runFullReconciliation(req.params.id);
            res.json(result);
        } catch (error: any) {
            console.error('Reconciliation Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/pod/:id/recon
    async getReconResults(req: Request, res: Response) {
        try {
            const results = await reconService.getReconResults(req.params.id);
            res.json(results);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/line/:lineId/review
    async reviewLine(req: Request, res: Response) {
        try {
            const { lineId } = req.params;
            const { action, receivedQty, damagedQty, note } = req.body;

            if (!action) return res.status(400).json({ error: 'action is required (ACCEPTED, OVERRIDDEN, REJECTED)' });

            const updateData: any = { reviewAction: action, reviewNote: note || null };
            if (action === 'OVERRIDDEN') {
                if (receivedQty !== undefined) updateData.receivedQty = parseInt(receivedQty);
                if (damagedQty !== undefined) updateData.damagedQty = parseInt(damagedQty);
                // Recalculate recon status based on overridden values
                const existing = await prisma.podLineRecon.findUnique({ where: { id: lineId } });
                if (existing) {
                    const newReceived = updateData.receivedQty ?? existing.receivedQty;
                    const newDamaged = updateData.damagedQty ?? existing.damagedQty;
                    if (newDamaged > 0) updateData.reconStatus = 'DAMAGED';
                    else if (newReceived === existing.sentQty) updateData.reconStatus = 'MATCH';
                    else if (newReceived > existing.sentQty) updateData.reconStatus = 'EXCESS';
                    else updateData.reconStatus = 'SHORT';
                }
            }

            const updated = await prisma.podLineRecon.update({ where: { id: lineId }, data: updateData });
            res.json(updated);
        } catch (error: any) {
            console.error('Review Line Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/exception/:exId/resolve
    async resolveException(req: Request, res: Response) {
        try {
            const { exId } = req.params;
            const { resolvedBy } = req.body;

            const updated = await prisma.podException.update({
                where: { id: exId },
                data: { resolved: true, resolvedBy, resolvedAt: new Date() }
            });
            res.json(updated);
        } catch (error: any) {
            console.error('Resolve Exception Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/approve
    async approvePod(req: Request, res: Response) {
        try {
            const { actedBy, comment } = req.body;
            // Ensure there's an approval record
            await approvalService.submitForApproval(req.params.id);
            const result = await approvalService.approve(req.params.id, actedBy || 'system', comment);
            res.json(result);
        } catch (error: any) {
            console.error('Approve Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/pod/:id/reject
    async rejectPod(req: Request, res: Response) {
        try {
            const { actedBy, comment } = req.body;
            await approvalService.submitForApproval(req.params.id);
            const result = await approvalService.reject(req.params.id, actedBy || 'system', comment);
            res.json(result);
        } catch (error: any) {
            console.error('Reject Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/pod/approvals/pending
    async getPendingApprovals(req: Request, res: Response) {
        try {
            const level = req.query.level ? parseInt(req.query.level as string) : undefined;
            const approvals = await approvalService.getPendingApprovals({ level });
            res.json(approvals);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/shipments
    async listShipments(req: Request, res: Response) {
        try {
            const awbNumber = req.query.awbNumber as string;
            const shipments = await podService.listShipments({ awbNumber });
            res.json(shipments);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/shipments
    async createShipment(req: Request, res: Response) {
        try {
            const { awbNumber, consigneeName, lineItems, origin, destination } = req.body;
            if (!awbNumber || !consigneeName) {
                return res.status(400).json({ error: 'awbNumber and consigneeName are required' });
            }
            const shipment = await podService.createShipment({
                awbNumber,
                consigneeName,
                lineItems: typeof lineItems === 'string' ? lineItems : JSON.stringify(lineItems),
                origin,
                destination,
            });
            res.json(shipment);
        } catch (error: any) {
            console.error('Create Shipment Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/shipments/bulk
    async bulkCreateShipments(req: Request, res: Response) {
        try {
            const { shipments } = req.body;
            if (!Array.isArray(shipments)) return res.status(400).json({ error: 'shipments array is required' });

            const formatted = shipments.map((s: any) => ({
                awbNumber: s.awbNumber,
                consigneeName: s.consigneeName,
                lineItems: typeof s.lineItems === 'string' ? s.lineItems : JSON.stringify(s.lineItems),
                origin: s.origin,
                destination: s.destination,
            }));

            const results = await podService.bulkCreateShipments(formatted);
            res.json({ results });
        } catch (error: any) {
            console.error('Bulk Create Shipments Error:', error);
            res.status(500).json({ error: error.message });
        }
    },
};
