import { PrismaClient, Prisma } from '@prisma/client';
import { podService } from './podService';

const prisma = new PrismaClient();

export const approvalService = {
    async submitForApproval(podUploadId: string): Promise<any> {
        // Check if already has pending approval
        const existing = await prisma.podApproval.findFirst({
            where: { podUploadId, action: 'PENDING' }
        });
        if (existing) return existing;

        return prisma.podApproval.create({
            data: { podUploadId, level: 1, action: 'PENDING' }
        });
    },

    async approve(podUploadId: string, actedBy: string, comment?: string): Promise<any> {
        const pendingApproval = await prisma.podApproval.findFirst({
            where: { podUploadId, action: 'PENDING' },
            orderBy: { level: 'asc' }
        });

        if (!pendingApproval) throw new Error('No pending approval found');

        // Update current approval
        await prisma.podApproval.update({
            where: { id: pendingApproval.id },
            data: { action: 'APPROVED', actedBy, comment, actedAt: new Date() }
        });

        if (pendingApproval.level < 2) {
            // Create next level approval
            await prisma.podApproval.create({
                data: { podUploadId, level: pendingApproval.level + 1, action: 'PENDING' }
            });
            return { status: 'ESCALATED', nextLevel: pendingApproval.level + 1 };
        } else {
            // Final approval - mark POD as APPROVED
            await podService.updateStatus(podUploadId, 'APPROVED');
            return { status: 'APPROVED' };
        }
    },

    async reject(podUploadId: string, actedBy: string, comment?: string): Promise<any> {
        const pendingApproval = await prisma.podApproval.findFirst({
            where: { podUploadId, action: 'PENDING' },
            orderBy: { level: 'asc' }
        });

        if (!pendingApproval) throw new Error('No pending approval found');

        await prisma.podApproval.update({
            where: { id: pendingApproval.id },
            data: { action: 'REJECTED', actedBy, comment, actedAt: new Date() }
        });

        await podService.updateStatus(podUploadId, 'REJECTED');
        return { status: 'REJECTED' };
    },

    async getPendingApprovals(filters?: { level?: number }) {
        const where: Prisma.PodApprovalWhereInput = { action: 'PENDING' };
        if (filters?.level) where.level = filters.level;

        return prisma.podApproval.findMany({
            where,
            include: {
                podUpload: {
                    include: { ocrResult: true, exceptions: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
    }
};
