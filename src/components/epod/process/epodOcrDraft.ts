import type { ProcessedItem, ProcessedOcrPatch } from '@/lib/epodApi';

export type EpodDeliveryReviewStatus = 'clean' | 'unclean' | null;

export type EpodOcrDraft = ProcessedOcrPatch & {
  deliveryReviewStatus?: EpodDeliveryReviewStatus;
};

export type ReviewedProcessedItem = ProcessedItem & {
  ocrData: ProcessedItem['ocrData'] & {
    deliveryReviewStatus?: EpodDeliveryReviewStatus;
  };
};

function buildReceivedQuantityNotes(item: ProcessedItem): string | null {
  if (item.ocrData.receivedQuantityNotes) {
    return item.ocrData.receivedQuantityNotes;
  }

  if (item.lineItems.length > 0) {
    return item.lineItems.map((line) => String(line.receivedQty)).join('\n');
  }

  if (item.receivedQty !== null && item.receivedQty !== undefined) {
    return String(item.receivedQty);
  }

  return null;
}

export function createEpodOcrDraft(item: ProcessedItem): EpodOcrDraft {
  return {
    extractedAwb: item.ocrData.extractedAwb,
    extractedConsignee: item.ocrData.extractedConsignee,
    extractedDeliveryDate: item.ocrData.extractedDeliveryDate,
    extractedFrom: item.ocrData.extractedFrom,
    extractedTo: item.ocrData.extractedTo,
    description: item.ocrData.description,
    receivedQuantityNotes: buildReceivedQuantityNotes(item),
    stampPresent: item.ocrData.stampPresent,
    signaturePresent: item.ocrData.signaturePresent,
    remarks: item.ocrData.remarks,
    conditionNotes: item.ocrData.conditionNotes,
    deliveryReviewStatus:
      (item as ReviewedProcessedItem).ocrData.deliveryReviewStatus ?? item.deliveryReviewStatus ?? null,
  };
}
