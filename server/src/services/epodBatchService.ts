import { PrismaClient } from '@prisma/client';
import { approvalService } from './approvalService';
import { podOcrService } from './podOcrService';
import { reconService } from './reconService';
import { podService } from './podService';
import { mockShipmentSeedService } from './mockShipmentSeedService';

const prisma = new PrismaClient();

const REVIEW_BUCKETS = {
    ready: 'READY_TO_SUBMIT',
    review: 'NEEDS_REVIEW',
    blocked: 'BLOCKED',
    unmapped: 'UNMAPPED_IMAGES',
    submitted: 'SUBMITTED_TO_CONSIGNOR',
} as const;

const activeBatchProcessors = new Set<string>();

function normalizeAwb(value: string): string {
    return value.trim().toUpperCase();
}

function parseSelectedAwbs(selectedAwbsJson: string): string[] {
    try {
        const parsed = JSON.parse(selectedAwbsJson);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((value): value is string => typeof value === 'string')
            .map(normalizeAwb);
    } catch {
        return [];
    }
}

function joinReasons(reasons: string[]): string | null {
    const filtered = reasons.filter(Boolean);
    return filtered.length > 0 ? filtered.join(' | ') : null;
}

export const epodBatchService = {
    async createBatch(data: { selectedAwbs: string[]; source?: string; createdBy?: string }) {
        await mockShipmentSeedService.ensureSeeded();
        const selectedAwbs = Array.from(new Set(data.selectedAwbs.map(normalizeAwb)));
        return prisma.epodBatchJob.create({
            data: {
                source: data.source || 'TRANSPORTER_PORTAL',
                createdBy: data.createdBy || 'transporter',
                selectedAwbsJson: JSON.stringify(selectedAwbs),
                status: 'UPLOADED',
            },
        });
    },

    async ensureBatch(batchId: string, data?: { selectedAwbs?: string[]; source?: string; createdBy?: string }) {
        const existing = await prisma.epodBatchJob.findUnique({ where: { id: batchId } });
        if (existing) return existing;

        return prisma.epodBatchJob.create({
            data: {
                id: batchId,
                source: data?.source || 'MANUAL',
                createdBy: data?.createdBy || 'system',
                selectedAwbsJson: JSON.stringify((data?.selectedAwbs || []).map(normalizeAwb)),
                status: 'UPLOADED',
            },
        });
    },

    async uploadFilesToBatch(batchId: string, files: Array<{ fileName: string; filePath: string }>, metadata?: { source?: string; uploadedBy?: string }) {
        await this.ensureBatch(batchId, { source: metadata?.source, createdBy: metadata?.uploadedBy });
        const uploads = await podService.createBulkUpload(files, {
            batchId,
            source: metadata?.source,
            uploadedBy: metadata?.uploadedBy,
        });

        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: {
                totalFiles: { increment: uploads.length },
                status: 'UPLOADED',
            },
        });

        await this.refreshBatchCounts(batchId);

        return uploads;
    },

    async startBatchProcessing(batchId: string) {
        await mockShipmentSeedService.ensureSeeded();
        const batch = await this.getBatch(batchId);
        if (!batch) throw new Error('Batch not found');

        if (!activeBatchProcessors.has(batchId)) {
            activeBatchProcessors.add(batchId);
            void this.processBatchInternal(batchId).finally(() => {
                activeBatchProcessors.delete(batchId);
            });
        }

        return batch;
    },

    async processBatchInternal(batchId: string) {
        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: { status: 'OCR_PROCESSING', cancelledAt: null },
        });

        const batch = await prisma.epodBatchJob.findUnique({ where: { id: batchId } });
        if (!batch) throw new Error('Batch not found');

        const selectedAwbs = new Set(parseSelectedAwbs(batch.selectedAwbsJson));
        const uploads = await prisma.podUpload.findMany({
            where: { batchId },
            orderBy: { createdAt: 'asc' },
        });

        for (const upload of uploads) {
            const freshBatch = await prisma.epodBatchJob.findUnique({ where: { id: batchId } });
            if (!freshBatch || freshBatch.status === 'CANCELLED') break;

            try {
                await podOcrService.processAndSave(upload.id);
                await prisma.epodBatchJob.update({
                    where: { id: batchId },
                    data: { status: 'MATCHING' },
                });

                const podWithOcr = await prisma.podUpload.findUnique({
                    where: { id: upload.id },
                    include: { ocrResult: true },
                });

                const extractedAwb = podWithOcr?.ocrResult?.awbNumber?.trim();
                if (!podWithOcr || !extractedAwb) {
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'UNMATCHED_AWB',
                            reviewBucket: REVIEW_BUCKETS.unmapped,
                            blockingReason: 'AWB not detected from OCR',
                            warningReason: null,
                            isInSelectedScope: false,
                        },
                    });
                    await this.refreshBatchCounts(batchId);
                    continue;
                }

                const normalizedAwb = normalizeAwb(extractedAwb);
                if (selectedAwbs.size > 0 && !selectedAwbs.has(normalizedAwb)) {
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'OUT_OF_SCOPE_AWB',
                            reviewBucket: REVIEW_BUCKETS.unmapped,
                            blockingReason: 'OCR extracted AWB not part of selected batch',
                            warningReason: null,
                            isInSelectedScope: false,
                        },
                    });
                    await this.refreshBatchCounts(batchId);
                    continue;
                }

                const awbMatch = await reconService.matchAwb(upload.id);
                if (!awbMatch.matched) {
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'UNMATCHED_AWB',
                            reviewBucket: REVIEW_BUCKETS.unmapped,
                            blockingReason: 'OCR extracted AWB could not be matched to shipment master',
                            warningReason: null,
                            isInSelectedScope: true,
                        },
                    });
                    await this.refreshBatchCounts(batchId);
                    continue;
                }

                if (awbMatch.flag === 'DUPLICATE') {
                    await podService.updateStatus(upload.id, 'REVIEW');
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'DUPLICATE_EPOD',
                            reviewBucket: REVIEW_BUCKETS.blocked,
                            blockingReason: `Duplicate AWB: POD already exists for AWB ${normalizedAwb}`,
                            warningReason: null,
                            isInSelectedScope: true,
                        },
                    });
                    await this.refreshBatchCounts(batchId);
                    continue;
                }

                await reconService.runFullReconciliation(upload.id);
                const reconciledPod = await prisma.podUpload.findUnique({
                    where: { id: upload.id },
                    include: { exceptions: true, ocrResult: true },
                });

                const reasons: string[] = [];
                const exceptionDescriptions = (reconciledPod?.exceptions || []).map((exception) => exception.description || exception.exceptionType);
                const hasSignatureMissing = exceptionDescriptions.some((description) => description.toLowerCase().includes('signature'));
                const hasStampMissing = exceptionDescriptions.some((description) => description.toLowerCase().includes('stamp'));

                if (hasSignatureMissing && hasStampMissing) {
                    reasons.push('Signature and stamp missing');
                } else {
                    if (hasSignatureMissing) reasons.push('Signature missing');
                    if (hasStampMissing) reasons.push('Stamp missing');
                }

                exceptionDescriptions.forEach((description) => {
                    if (!description.toLowerCase().includes('signature') && !description.toLowerCase().includes('stamp')) {
                        reasons.push(description);
                    }
                });

                if (reasons.length > 0) {
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'NEEDS_REVIEW',
                            reviewBucket: REVIEW_BUCKETS.review,
                            blockingReason: null,
                            warningReason: joinReasons(reasons),
                            isInSelectedScope: true,
                        },
                    });
                } else {
                    await prisma.podUpload.update({
                        where: { id: upload.id },
                        data: {
                            epodItemStatus: 'READY',
                            reviewBucket: REVIEW_BUCKETS.ready,
                            blockingReason: null,
                            warningReason: null,
                            isInSelectedScope: true,
                        },
                    });
                }

                await this.refreshBatchCounts(batchId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'OCR processing failed';
                await prisma.podUpload.update({
                    where: { id: upload.id },
                    data: {
                        epodItemStatus: 'FAILED',
                        reviewBucket: REVIEW_BUCKETS.blocked,
                        blockingReason: message,
                        warningReason: null,
                    },
                });
                await this.refreshBatchCounts(batchId);
            }
        }

        const summary = await this.refreshBatchCounts(batchId);
        const finalStatus = summary.cancelledAt
            ? 'CANCELLED'
            : summary.readyCount > 0 || summary.needsReviewCount > 0 || summary.blockedCount > 0 || summary.unmatchedCount > 0
                ? 'REVIEW_REQUIRED'
                : 'READY_TO_SUBMIT';

        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: { status: finalStatus },
        });
    },

    async submitBatch(batchId: string, actedBy?: string) {
        const readyUploads = await prisma.podUpload.findMany({
            where: {
                batchId,
                reviewBucket: REVIEW_BUCKETS.ready,
                epodItemStatus: 'READY',
            },
        });

        const submittedIds: string[] = [];
        for (const upload of readyUploads) {
            await approvalService.submitForApproval(upload.id);
            await podService.updateStatus(upload.id, 'SUBMITTED');
            await prisma.podUpload.update({
                where: { id: upload.id },
                data: {
                    epodItemStatus: 'SUBMITTED',
                    reviewBucket: REVIEW_BUCKETS.submitted,
                    submittedToConsignorAt: new Date(),
                    uploadedBy: actedBy || upload.uploadedBy,
                },
            });
            submittedIds.push(upload.id);
        }

        await this.refreshBatchCounts(batchId);
        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: { status: submittedIds.length > 0 ? 'SUBMITTED' : 'REVIEW_REQUIRED' },
        });

        return {
            submittedCount: submittedIds.length,
            submittedIds,
        };
    },

    async cancelBatch(batchId: string) {
        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
            },
        });
        return this.getBatch(batchId);
    },

    async refreshBatchCounts(batchId: string) {
        const [batch, uploads] = await Promise.all([
            prisma.epodBatchJob.findUnique({ where: { id: batchId } }),
            prisma.podUpload.findMany({ where: { batchId } }),
        ]);

        if (!batch) throw new Error('Batch not found');

        const summary = {
            totalFiles: uploads.length,
            processedFiles: uploads.filter((upload) => upload.epodItemStatus !== null).length,
            matchedCount: uploads.filter((upload) => upload.isInSelectedScope && upload.reviewBucket !== REVIEW_BUCKETS.unmapped).length,
            unmatchedCount: uploads.filter((upload) => upload.reviewBucket === REVIEW_BUCKETS.unmapped).length,
            needsReviewCount: uploads.filter((upload) => upload.reviewBucket === REVIEW_BUCKETS.review).length,
            blockedCount: uploads.filter((upload) => upload.reviewBucket === REVIEW_BUCKETS.blocked).length,
            readyCount: uploads.filter((upload) => upload.reviewBucket === REVIEW_BUCKETS.ready).length,
            submittedCount: uploads.filter((upload) => upload.reviewBucket === REVIEW_BUCKETS.submitted).length,
            failedCount: uploads.filter((upload) => upload.epodItemStatus === 'FAILED').length,
            cancelledAt: batch.cancelledAt,
        };

        await prisma.epodBatchJob.update({
            where: { id: batchId },
            data: summary,
        });

        return summary;
    },

    async getBatch(batchId: string) {
        const batch = await prisma.epodBatchJob.findUnique({ where: { id: batchId } });
        if (!batch) return null;

        return {
            ...batch,
            selectedAwbs: parseSelectedAwbs(batch.selectedAwbsJson),
            isProcessing: activeBatchProcessors.has(batchId),
        };
    },

    async getBatchItems(batchId: string) {
        const uploads = await prisma.podUpload.findMany({
            where: { batchId },
            include: {
                ocrResult: true,
                exceptions: true,
                approvals: { orderBy: { level: 'asc' } },
            },
            orderBy: { createdAt: 'asc' },
        });

        return uploads.map((upload) => {
            const matchedAwb = upload.awbNumber || upload.ocrResult?.awbNumber || '';
            const fallbackShipment = matchedAwb
                ? mockShipmentSeedService.getShipmentByAwb(matchedAwb)
                : mockShipmentSeedService.getShipmentFromFileName(upload.fileName);
            const originText = fallbackShipment?.origin || null;
            const originParts = originText ? originText.split(',').map((value) => value.trim()) : [];
            const origin = originParts.length > 0 ? originParts[0] : null;
            const originCity = originParts.length > 1 ? originParts.slice(1).join(', ') : null;

            return {
            id: upload.id,
            fileName: upload.fileName,
            awbNumber: upload.awbNumber,
            status: upload.status,
            epodItemStatus: upload.epodItemStatus,
            reviewBucket: upload.reviewBucket,
            blockingReason: upload.blockingReason,
            warningReason: upload.warningReason,
            submittedToConsignorAt: upload.submittedToConsignorAt,
            isInSelectedScope: upload.isInSelectedScope,
            ocrConfidence: upload.ocrResult?.confidence ?? null,
            extractedAwb: upload.ocrResult?.awbNumber ?? null,
            shipmentId: fallbackShipment?.shipmentId ?? null,
            consigneeName: fallbackShipment?.consigneeName ?? null,
            origin,
            originCity,
            destination: fallbackShipment?.destination ?? null,
            transporter: fallbackShipment?.transporter ?? null,
            exceptions: upload.exceptions.map((exception) => ({
                id: exception.id,
                type: exception.exceptionType,
                severity: exception.severity,
                description: exception.description,
                resolved: exception.resolved,
            })),
            approvals: upload.approvals.map((approval) => ({
                id: approval.id,
                level: approval.level,
                action: approval.action,
                actedBy: approval.actedBy,
                actedAt: approval.actedAt,
            })),
        };
        });
    },
};
