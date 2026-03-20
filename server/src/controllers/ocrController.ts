import { Request, Response } from 'express';
import { configService } from '../services/configService';
import { ocrService } from '../services/ocrService';
import fs from 'fs';

export const ocrController = {
    // GET /api/ocr/config
    async getConfig(req: Request, res: Response) {
        try {
            const { module, consignor, transporter } = req.query;

            if (!module || typeof module !== 'string') {
                return res.status(400).json({ error: "Module code is required" });
            }

            const config = await configService.resolveOcrConfig(
                module,
                consignor as string | undefined,
                transporter as string | undefined
            );

            if (!config) {
                return res.status(404).json({ error: "No configuration found" });
            }

            res.json(config);
        } catch (error: any) {
            console.error("Get Config Error:", error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/ocr/config
    async saveConfig(req: Request, res: Response) {
        try {
            const { module, consignor, transporter, prompt, fieldMappings, updatedBy } = req.body;

            if (!module) return res.status(400).json({ error: "Module is required" });

            const config = await configService.upsertConfig({
                moduleCode: module,
                consignorCode: consignor,
                transporterCode: transporter,
                prompt,
                fieldMappings,
                updatedBy
            });

            res.json(config);
        } catch (error: any) {
            console.error("Save Config Error:", error);
            res.status(500).json({ error: error.message });
        }
    },

    // GET /api/ocr/configs
    async listConfigs(req: Request, res: Response) {
        try {
            const filters = {
                module: req.query.module as string,
                consignor: req.query.consignor as string,
                transporter: req.query.transporter as string
            };
            const configs = await configService.getConfigs(filters);
            res.json(configs);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/ocr/test (Sandbox)
    async runTest(req: Request, res: Response) {
        try {
            if (!req.file) return res.status(400).json({ error: "File is required" });

            const { module, consignor, transporter, overridePrompt } = req.body;
            let prompt = overridePrompt;

            // If no override, try to resolve from DB, else default
            if (!prompt) {
                if (module) {
                    const config = await configService.resolveOcrConfig(module, consignor, transporter);
                    prompt = config?.prompt;
                }
                if (!prompt) prompt = "Extract all data as JSON.";
            }

            const rawOcrOutput = await ocrService.processDocumentWithOpenAI(req.file.path, prompt);

            // Clean up uploaded file
            fs.unlinkSync(req.file.path);

            res.json({ rawOcrOutput });
        } catch (error: any) {
            console.error("Test Error:", error);
            res.status(500).json({ error: error.message });
        }
    },

    // POST /api/ocr/process-document (Prod)
    async processDocument(req: Request, res: Response) {
        try {
            if (!req.file) return res.status(400).json({ error: "File is required" });

            const { module, consignor, transporter, overridePrompt, overrideMappings } = req.body;

            if (!module) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: "Module code is required for processing" });
            }

            const config = await configService.resolveOcrConfig(module, consignor, transporter);

            const finalPrompt = overridePrompt || config?.prompt || "Extract key fields as JSON.";
            const finalMappings = overrideMappings ? JSON.parse(overrideMappings) : (config?.fieldMappings || []);

            // 1. Run OCR
            const rawOcrOutput = await ocrService.processDocumentWithOpenAI(req.file.path, finalPrompt);

            // 2. Cleanup
            fs.unlinkSync(req.file.path);

            // 3. Apply Mappings
            const { structuredPayload, missingFields, mappingUsed } = ocrService.applyMappings(rawOcrOutput, finalMappings as any[]);

            const status = missingFields.length > 0 ? 'warning' : 'success';

            res.json({
                status,
                module,
                consignor,
                transporter,
                structuredPayload,
                missingMandatoryFields: missingFields,
                rawOcrOutput,
                mappingUsed
            });

        } catch (error: any) {
            console.error("Process Error:", error);
            res.status(500).json({ error: error.message });
        }
    }
};
