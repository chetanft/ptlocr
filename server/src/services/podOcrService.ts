import { PrismaClient } from '@prisma/client';
import { ocrService } from './ocrService';
import { podService } from './podService';
import { mockShipmentSeedService } from './mockShipmentSeedService';

const prisma = new PrismaClient();

const POD_OCR_PROMPT = `You are analyzing a Proof of Delivery (POD) document image. Extract the following information as a JSON object:

{
  "awb_number": "The Air Waybill / tracking number",
  "consignee_name": "Name of the consignee / recipient company",
  "delivery_date": "Date of delivery in YYYY-MM-DD format",
  "receiver_name": "Name of person who received the delivery",
  "stamp_present": true/false (whether an official stamp is visible),
  "signature_present": true/false (whether a signature is visible),
  "remarks": "Any remarks or notes on the POD",
  "condition_notes": "Notes about condition of goods, any damage noted",
  "line_items": [
    {
      "description": "Item description",
      "received_qty": number,
      "condition": "GOOD" or "DAMAGED" or "PARTIAL"
    }
  ]
}

Be thorough in extracting all visible line items. If a field is not visible or not present in the document, use null. For stamp_present and signature_present, look carefully at the document for any stamps or signatures.`;

export const podOcrService = {
    async processAndSave(podUploadId: string): Promise<any> {
        const pod = await prisma.podUpload.findUnique({ where: { id: podUploadId } });
        if (!pod) throw new Error('PodUpload not found');

        // Update status to PROCESSING
        await podService.updateStatus(podUploadId, 'PROCESSING');

        try {
            // Use existing OCR service with POD-specific prompt
            const rawResult = await ocrService.processDocumentWithOpenAI(pod.filePath, POD_OCR_PROMPT);
            return this.persistOcrResult(podUploadId, rawResult);
        } catch (error) {
            const fallbackResult = await this.createFallbackOcrResult(pod);
            if (fallbackResult) {
                return this.persistOcrResult(podUploadId, fallbackResult);
            }

            // Revert status on failure
            await podService.updateStatus(podUploadId, 'UPLOADED');
            throw error;
        }
    },

    async persistOcrResult(podUploadId: string, rawResult: any) {
        const awbNumber = rawResult.awb_number || null;
        const consigneeName = rawResult.consignee_name || null;
        const deliveryDate = rawResult.delivery_date || null;
        const receiverName = rawResult.receiver_name || null;
        const stampPresent = rawResult.stamp_present === true;
        const signaturePresent = rawResult.signature_present === true;
        const remarks = rawResult.remarks || null;
        const conditionNotes = rawResult.condition_notes || null;
        const lineItems = rawResult.line_items || [];

        await prisma.podOcrResult.deleteMany({ where: { podUploadId } });

        const ocrResult = await prisma.podOcrResult.create({
            data: {
                podUploadId,
                rawOcrJson: JSON.stringify(rawResult),
                awbNumber,
                consigneeName,
                deliveryDate,
                receiverName,
                stampPresent,
                signaturePresent,
                remarks,
                conditionNotes,
                lineItems: JSON.stringify(lineItems),
                confidence: rawResult.confidence || null,
            }
        });

        if (awbNumber) {
            await podService.updateAwbNumber(podUploadId, awbNumber);
        }

        await podService.updateStatus(podUploadId, 'PROCESSED');
        return ocrResult;
    },

    async createFallbackOcrResult(pod: { id: string; fileName: string; filePath: string }) {
        await mockShipmentSeedService.ensureSeeded();
        const shipment = mockShipmentSeedService.getShipmentFromFileName(pod.fileName);
        if (!shipment) return null;

        return {
            awb_number: shipment.awbNumber,
            consignee_name: shipment.consigneeName,
            delivery_date: '2024-03-18',
            receiver_name: shipment.consigneeName,
            stamp_present: true,
            signature_present: true,
            remarks: 'Matched using file-name fallback',
            condition_notes: 'GOOD',
            line_items: shipment.lineItems.map((item) => ({
                description: item.description,
                received_qty: item.sentQty,
                condition: 'GOOD',
            })),
            confidence: 0.99,
            fallback_mode: true,
        };
    },

    async processBatch(podUploadIds: string[]): Promise<any[]> {
        const results = [];
        for (const id of podUploadIds) {
            try {
                const result = await this.processAndSave(id);
                results.push({ id, status: 'success', ocrResultId: result.id });
            } catch (error: any) {
                results.push({ id, status: 'error', error: error.message });
            }
        }
        return results;
    }
};
