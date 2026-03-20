import { PrismaClient, OcrConfig, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const configService = {
    // Config Resolution Strategy:
    // 1. Module + Consignor + Transporter
    // 2. Module + Consignor
    // 3. Module Only
    async resolveOcrConfig(
        moduleCode: string,
        consignorCode?: string, // optional string or undefined
        transporterCode?: string // optional string or undefined
    ): Promise<OcrConfig | null> {

        // Ensure we handle "undefined" or empty string as null for querying
        const cCode = consignorCode || null;
        const tCode = transporterCode || null;

        // Try Level 1: Specific
        if (cCode && tCode) {
            const config = await prisma.ocrConfig.findFirst({
                where: { moduleCode, consignorCode: cCode, transporterCode: tCode, isActive: true },
            });
            if (config) return config;
        }

        // Try Level 2: Consignor only
        if (cCode) {
            const config = await prisma.ocrConfig.findFirst({
                where: { moduleCode, consignorCode: cCode, transporterCode: null, isActive: true },
            });
            if (config) return config;
        }

        // Try Level 3: Module Default
        const config = await prisma.ocrConfig.findFirst({
            where: { moduleCode, consignorCode: null, transporterCode: null, isActive: true },
        });

        return config;
    },

    async upsertConfig(data: {
        moduleCode: string;
        consignorCode?: string | null;
        transporterCode?: string | null;
        prompt?: string;
        fieldMappings: any;
        updatedBy?: string;
    }) {
        const { moduleCode, consignorCode, transporterCode, prompt, fieldMappings, updatedBy } = data;

        // Check if exists
        const existing = await prisma.ocrConfig.findFirst({
            where: {
                moduleCode,
                consignorCode: consignorCode || null,
                transporterCode: transporterCode || null,
            },
        });

        if (existing) {
            return prisma.ocrConfig.update({
                where: { id: existing.id },
                data: {
                    prompt,
                    fieldMappings: JSON.stringify(fieldMappings),
                    updatedBy,
                    isActive: true, // Reactivate if it was inactive
                },
            });
        } else {
            return prisma.ocrConfig.create({
                data: {
                    moduleCode,
                    consignorCode: consignorCode || null,
                    transporterCode: transporterCode || null,
                    prompt,
                    fieldMappings: JSON.stringify(fieldMappings),
                    createdBy: updatedBy,
                    updatedBy,
                },
            });
        }
    },

    async getConfigs(filters: { module?: string; consignor?: string; transporter?: string }) {
        const where: Prisma.OcrConfigWhereInput = { isActive: true };
        if (filters.module) where.moduleCode = filters.module;
        if (filters.consignor) where.consignorCode = filters.consignor;
        if (filters.transporter) where.transporterCode = filters.transporter;

        return prisma.ocrConfig.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
        });
    },

    async getModule(code: string) {
        return prisma.ocrModule.findUnique({ where: { code } });
    }
};
