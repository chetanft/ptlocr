import { PrismaClient } from '@prisma/client';
import { podService } from './podService';

const prisma = new PrismaClient();

// Simple word-overlap similarity score
function wordOverlapScore(a: string, b: string): number {
    const wordsA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const wordsB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;
    const setB = new Set(wordsB);
    const matches = wordsA.filter(w => setB.has(w)).length;
    return matches / Math.max(wordsA.length, wordsB.length);
}

const DAMAGE_KEYWORDS = ['damage', 'damaged', 'broken', 'torn', 'crushed', 'wet', 'dented', 'scratched', 'defective'];

export const reconService = {
    async matchAwb(podUploadId: string): Promise<{ matched: boolean; shipment?: any; flag?: string }> {
        const pod = await prisma.podUpload.findUnique({
            where: { id: podUploadId },
            include: { ocrResult: true }
        });
        if (!pod || !pod.ocrResult) throw new Error('POD or OCR result not found');

        const awbNumber = pod.ocrResult.awbNumber;
        if (!awbNumber) {
            return { matched: false, flag: 'UNMATCHED' };
        }

        // Only treat as duplicate if a prior POD for the same AWB has already
        // been submitted into the review/approval flow or approved.
        const existingPods = await prisma.podUpload.findMany({
            where: {
                awbNumber,
                id: { not: podUploadId },
                OR: [
                    { submittedToConsignorAt: { not: null } },
                    { status: { in: ['SUBMITTED', 'APPROVED'] } },
                ],
            }
        });

        const shipment = await podService.findShipmentByAwb(awbNumber);

        if (!shipment) {
            return { matched: false, flag: 'UNMATCHED' };
        }

        if (existingPods.length > 0) {
            return { matched: true, shipment, flag: 'DUPLICATE' };
        }

        return { matched: true, shipment };
    },

    async reconcileLineItems(podUploadId: string, shipmentId: string): Promise<any[]> {
        const [ocrResult, shipment] = await Promise.all([
            prisma.podOcrResult.findUnique({ where: { podUploadId } }),
            prisma.shipment.findUnique({ where: { id: shipmentId } })
        ]);

        if (!ocrResult || !shipment) throw new Error('OCR result or Shipment not found');

        const sentItems: Array<{ sku?: string; description: string; sentQty: number }> = JSON.parse(shipment.lineItems);
        const receivedItems: Array<{ description: string; received_qty: number; condition?: string }> = JSON.parse(ocrResult.lineItems || '[]');

        // Delete existing recon records for this POD
        await prisma.podLineRecon.deleteMany({ where: { podUploadId } });

        const reconResults = [];
        const usedReceivedIndices = new Set<number>();

        for (const sentItem of sentItems) {
            // Find best matching received item by description
            let bestMatchIdx = -1;
            let bestScore = 0;

            for (let i = 0; i < receivedItems.length; i++) {
                if (usedReceivedIndices.has(i)) continue;
                const score = wordOverlapScore(sentItem.description, receivedItems[i].description);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatchIdx = i;
                }
            }

            let receivedQty = 0;
            let damagedQty = 0;
            let reconStatus = 'SHORT';

            if (bestMatchIdx >= 0 && bestScore >= 0.3) {
                usedReceivedIndices.add(bestMatchIdx);
                const matched = receivedItems[bestMatchIdx];
                receivedQty = matched.received_qty || 0;

                if (matched.condition === 'DAMAGED') {
                    damagedQty = receivedQty;
                    reconStatus = 'DAMAGED';
                } else if (receivedQty === sentItem.sentQty) {
                    reconStatus = 'MATCH';
                } else if (receivedQty > sentItem.sentQty) {
                    reconStatus = 'EXCESS';
                } else {
                    reconStatus = 'SHORT';
                }
            }

            const recon = await prisma.podLineRecon.create({
                data: {
                    podUploadId,
                    shipmentId,
                    sku: sentItem.sku || null,
                    description: sentItem.description,
                    sentQty: sentItem.sentQty,
                    receivedQty,
                    damagedQty,
                    reconStatus,
                }
            });
            reconResults.push(recon);
        }

        return reconResults;
    },

    async detectExceptions(podUploadId: string): Promise<any[]> {
        const pod = await prisma.podUpload.findUnique({
            where: { id: podUploadId },
            include: { ocrResult: true, lineRecons: true }
        });
        if (!pod) throw new Error('POD not found');

        // Clear existing unresolved exceptions
        await prisma.podException.deleteMany({ where: { podUploadId, resolved: false } });

        const exceptions: Array<{ exceptionType: string; severity: string; description: string }> = [];

        // Check AWB match status
        const awbMatch = await this.matchAwb(podUploadId);
        if (awbMatch.flag === 'UNMATCHED') {
            exceptions.push({
                exceptionType: 'UNMATCHED_POD',
                severity: 'HIGH',
                description: `AWB number ${pod.ocrResult?.awbNumber || 'unknown'} not found in shipment master`
            });
        }
        if (awbMatch.flag === 'DUPLICATE') {
            exceptions.push({
                exceptionType: 'DUPLICATE_POD',
                severity: 'MEDIUM',
                description: `Another POD already exists for AWB ${pod.ocrResult?.awbNumber}`
            });
        }

        // Check line items for short delivery
        const shortItems = pod.lineRecons.filter(l => l.reconStatus === 'SHORT');
        if (shortItems.length > 0) {
            exceptions.push({
                exceptionType: 'SHORT_DELIVERY',
                severity: 'HIGH',
                description: `${shortItems.length} item(s) with short delivery`
            });
        }

        // Check for damaged items
        const damagedItems = pod.lineRecons.filter(l => l.reconStatus === 'DAMAGED' || l.damagedQty > 0);
        const ocrRemarks = (pod.ocrResult?.remarks || '').toLowerCase();
        const ocrCondition = (pod.ocrResult?.conditionNotes || '').toLowerCase();
        const hasDamageKeyword = DAMAGE_KEYWORDS.some(kw => ocrRemarks.includes(kw) || ocrCondition.includes(kw));

        if (damagedItems.length > 0 || hasDamageKeyword) {
            exceptions.push({
                exceptionType: 'DAMAGED_ITEMS',
                severity: 'HIGH',
                description: `Damaged items detected${damagedItems.length > 0 ? `: ${damagedItems.length} item(s)` : ' in remarks'}`
            });
        }

        // Check stamp
        if (pod.ocrResult && !pod.ocrResult.stampPresent) {
            exceptions.push({
                exceptionType: 'STAMP_MISSING',
                severity: 'MEDIUM',
                description: 'Official stamp not detected on POD'
            });
        }

        // Check signature
        if (pod.ocrResult && !pod.ocrResult.signaturePresent) {
            exceptions.push({
                exceptionType: 'SIGNATURE_MISSING',
                severity: 'MEDIUM',
                description: 'Signature not detected on POD'
            });
        }

        // Save all exceptions
        const savedExceptions = [];
        for (const exc of exceptions) {
            const saved = await prisma.podException.create({
                data: { podUploadId, ...exc }
            });
            savedExceptions.push(saved);
        }

        return savedExceptions;
    },

    async runFullReconciliation(podUploadId: string) {
        const awbMatch = await this.matchAwb(podUploadId);
        let lineRecons: any[] = [];

        if (awbMatch.matched && awbMatch.shipment) {
            lineRecons = await this.reconcileLineItems(podUploadId, awbMatch.shipment.id);
        }

        const exceptions = await this.detectExceptions(podUploadId);

        // Update status to REVIEW
        await podService.updateStatus(podUploadId, 'REVIEW');

        return { awbMatch, lineRecons, exceptions };
    },

    async getReconResults(podUploadId: string) {
        const [lineRecons, exceptions] = await Promise.all([
            prisma.podLineRecon.findMany({ where: { podUploadId }, include: { shipment: true } }),
            prisma.podException.findMany({ where: { podUploadId } })
        ]);
        return { lineRecons, exceptions };
    }
};
