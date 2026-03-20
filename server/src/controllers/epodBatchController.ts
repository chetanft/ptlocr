import { Request, Response } from 'express';
import { epodBatchService } from '../services/epodBatchService';

export const epodBatchController = {
    async createBatch(req: Request, res: Response) {
        try {
            const { selectedAwbs, source, createdBy } = req.body;
            if (selectedAwbs !== undefined && !Array.isArray(selectedAwbs)) {
                return res.status(400).json({ error: 'selectedAwbs must be an array when provided' });
            }

            const batch = await epodBatchService.createBatch({
                selectedAwbs: Array.isArray(selectedAwbs) ? selectedAwbs : [],
                source,
                createdBy,
            });
            res.json(batch);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create batch';
            res.status(500).json({ error: message });
        }
    },

    async uploadBatchFiles(req: Request, res: Response) {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                return res.status(400).json({ error: 'Files are required' });
            }

            const { source, uploadedBy } = req.body;
            const uploads = await epodBatchService.uploadFilesToBatch(
                req.params.batchId,
                files.map((file) => ({ fileName: file.originalname, filePath: file.path })),
                { source, uploadedBy },
            );

            const batch = await epodBatchService.getBatch(req.params.batchId);
            res.json({ batch, uploads });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to upload batch files';
            res.status(500).json({ error: message });
        }
    },

    async processBatch(req: Request, res: Response) {
        try {
            const batch = await epodBatchService.startBatchProcessing(req.params.batchId);
            res.json(batch);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process batch';
            res.status(500).json({ error: message });
        }
    },

    async getBatch(req: Request, res: Response) {
        try {
            const batch = await epodBatchService.getBatch(req.params.batchId);
            if (!batch) return res.status(404).json({ error: 'Batch not found' });
            res.json(batch);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get batch';
            res.status(500).json({ error: message });
        }
    },

    async getBatchItems(req: Request, res: Response) {
        try {
            const items = await epodBatchService.getBatchItems(req.params.batchId);
            res.json({ items });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get batch items';
            res.status(500).json({ error: message });
        }
    },

    async submitBatch(req: Request, res: Response) {
        try {
            const result = await epodBatchService.submitBatch(req.params.batchId, req.body?.actedBy);
            const batch = await epodBatchService.getBatch(req.params.batchId);
            res.json({ batch, ...result });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit batch';
            res.status(500).json({ error: message });
        }
    },

    async cancelBatch(req: Request, res: Response) {
        try {
            const batch = await epodBatchService.cancelBatch(req.params.batchId);
            res.json(batch);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to cancel batch';
            res.status(500).json({ error: message });
        }
    },
};
