import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const podService = {
    async createUpload(data: { fileName: string; filePath: string; source?: string; awbNumber?: string; uploadedBy?: string; batchId?: string }) {
        return prisma.podUpload.create({ data });
    },

    async createBulkUpload(files: Array<{ fileName: string; filePath: string }>, metadata: { source?: string; uploadedBy?: string; batchId: string }) {
        const uploads = files.map(f => prisma.podUpload.create({
            data: { fileName: f.fileName, filePath: f.filePath, source: metadata.source, uploadedBy: metadata.uploadedBy, batchId: metadata.batchId }
        }));
        return Promise.all(uploads);
    },

    async listPods(filters: { status?: string; awbNumber?: string; batchId?: string; page?: number; limit?: number }) {
        const where: Prisma.PodUploadWhereInput = {};
        if (filters.status) where.status = filters.status;
        if (filters.awbNumber) where.awbNumber = { contains: filters.awbNumber };
        if (filters.batchId) where.batchId = filters.batchId;

        const page = filters.page || 1;
        const limit = filters.limit || 20;

        const [items, total] = await Promise.all([
            prisma.podUpload.findMany({
                where,
                include: { ocrResult: true, exceptions: true, approvals: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.podUpload.count({ where })
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    async getPodDetail(id: string) {
        return prisma.podUpload.findUnique({
            where: { id },
            include: {
                ocrResult: true,
                lineRecons: { include: { shipment: true } },
                exceptions: true,
                approvals: { orderBy: { level: 'asc' } },
            }
        });
    },

    async updateStatus(id: string, status: string) {
        return prisma.podUpload.update({ where: { id }, data: { status } });
    },

    async updateAwbNumber(id: string, awbNumber: string) {
        return prisma.podUpload.update({ where: { id }, data: { awbNumber } });
    },

    async getStats() {
        const [total, pending, exceptions, approved, rejected, processing] = await Promise.all([
            prisma.podUpload.count(),
            prisma.podUpload.count({ where: { status: { in: ['REVIEW', 'PROCESSED'] } } }),
            prisma.podException.count({ where: { resolved: false } }),
            prisma.podUpload.count({ where: { status: 'APPROVED' } }),
            prisma.podUpload.count({ where: { status: 'REJECTED' } }),
            prisma.podUpload.count({ where: { status: 'PROCESSING' } }),
        ]);
        return { total, pending, exceptions, approved, rejected, processing };
    },

    // Shipment CRUD
    async listShipments(filters?: { awbNumber?: string }) {
        const where: Prisma.ShipmentWhereInput = {};
        if (filters?.awbNumber) where.awbNumber = { contains: filters.awbNumber };
        return prisma.shipment.findMany({ where, orderBy: { createdAt: 'desc' } });
    },

    async createShipment(data: { awbNumber: string; consigneeName: string; lineItems: string; origin?: string; destination?: string }) {
        return prisma.shipment.create({ data });
    },

    async bulkCreateShipments(shipments: Array<{ awbNumber: string; consigneeName: string; lineItems: string; origin?: string; destination?: string }>) {
        const results = [];
        for (const s of shipments) {
            try {
                const created = await prisma.shipment.create({ data: s });
                results.push({ awbNumber: s.awbNumber, status: 'created', id: created.id });
            } catch (e: any) {
                results.push({ awbNumber: s.awbNumber, status: 'error', error: e.message });
            }
        }
        return results;
    },

    async findShipmentByAwb(awbNumber: string) {
        return prisma.shipment.findUnique({ where: { awbNumber } });
    }
};
