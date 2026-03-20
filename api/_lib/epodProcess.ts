import { extractFieldsFromFile, type EpodOcrResult } from './openaiOcr.js';
import { findShipmentByAwb, findShipmentByFileName, normalizeAwb, type ShipmentRecord } from './shipmentMaster.js';

export interface ProcessedItem {
  id: string;
  fileName: string;
  awbNumber: string | null;
  shipmentId: string | null;
  fromName: string | null;
  fromSubtext: string | null;
  toName: string | null;
  toSubtext: string | null;
  transporter: string | null;
  consigneeName: string | null;
  statusLabel: 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
  statusVariant: 'success' | 'warning' | 'danger' | 'secondary';
  reason: string;
  confidence: number;
  confidenceLabel: string;
  stampPresent: boolean;
  signaturePresent: boolean;
  ocrFields: EpodOcrResult;
}

export interface ProcessBatchResult {
  summary: {
    totalAwbs: number;
    totalUploadedImages: number;
    matchedCount: number;
    needsReviewCount: number;
    skippedCount: number;
    unmappedCount: number;
  };
  items: ProcessedItem[];
}

function classifyItem(
  extracted: EpodOcrResult,
  confidence: number,
  matchedShipment: ShipmentRecord | null,
  selectedAwbs: string[] | null,
  fileName: string,
): { statusLabel: ProcessedItem['statusLabel']; statusVariant: ProcessedItem['statusVariant']; reason: string } {
  const extractedAwb = extracted.awb_number;

  // No AWB extracted at all
  if (!extractedAwb) {
    return { statusLabel: 'Unmapped', statusVariant: 'secondary', reason: 'No AWB detected in image' };
  }

  // AWB not in shipment master
  if (!matchedShipment) {
    return { statusLabel: 'Unmapped', statusVariant: 'secondary', reason: `AWB ${extractedAwb} not found in shipment master` };
  }

  // AWB not in selected scope (if selection mode)
  if (selectedAwbs && selectedAwbs.length > 0) {
    const normalizedSelected = selectedAwbs.map(normalizeAwb);
    if (!normalizedSelected.includes(normalizeAwb(extractedAwb))) {
      return { statusLabel: 'Skipped', statusVariant: 'danger', reason: `AWB ${extractedAwb} not in selected scope` };
    }
  }

  // Low confidence OCR
  if (confidence < 0.4) {
    return { statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Low OCR confidence — manual verification needed' };
  }

  // Missing stamp or signature
  if (!extracted.stamp_present || !extracted.signature_present) {
    const missing: string[] = [];
    if (!extracted.stamp_present) missing.push('stamp');
    if (!extracted.signature_present) missing.push('signature');
    return { statusLabel: 'Needs Review', statusVariant: 'warning', reason: `Missing ${missing.join(' and ')}` };
  }

  // Damage/remarks detected
  if (extracted.remarks || extracted.condition_notes) {
    const text = (extracted.remarks || '') + ' ' + (extracted.condition_notes || '');
    const damageKeywords = ['damage', 'broken', 'torn', 'wet', 'crushed', 'short', 'shortage'];
    if (damageKeywords.some(kw => text.toLowerCase().includes(kw))) {
      return { statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Damage or shortage noted in remarks' };
    }
  }

  // All good
  return { statusLabel: 'Matched', statusVariant: 'success', reason: 'AWB matched, all validations passed' };
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

export async function processEpodBatch(
  files: Array<{ buffer: Buffer; name: string }>,
  selectedAwbs: string[] | null,
  apiKey: string,
): Promise<ProcessBatchResult> {
  const items: ProcessedItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`Processing ${i + 1}/${files.length}: ${file.name}`);

    // 1. Run OCR
    const { result: ocrFields, confidence } = await extractFieldsFromFile(file.buffer, file.name, apiKey);

    // 2. Match shipment
    let matchedShipment: ShipmentRecord | null = null;
    if (ocrFields.awb_number) {
      matchedShipment = findShipmentByAwb(ocrFields.awb_number);
    }
    if (!matchedShipment) {
      matchedShipment = findShipmentByFileName(file.name);
    }

    // 3. Classify
    const classification = classifyItem(ocrFields, confidence, matchedShipment, selectedAwbs, file.name);

    // 4. Build display row
    items.push({
      id: `item-${i}-${Date.now()}`,
      fileName: file.name,
      awbNumber: ocrFields.awb_number ?? matchedShipment?.awbNumber ?? null,
      shipmentId: matchedShipment?.shipmentId ?? null,
      fromName: matchedShipment?.origin ?? ocrFields.consignor_name ?? null,
      fromSubtext: matchedShipment?.originCity ?? ocrFields.from_city ?? null,
      toName: matchedShipment?.consigneeName ?? ocrFields.consignee_name ?? null,
      toSubtext: matchedShipment?.destination ?? ocrFields.to_city ?? null,
      transporter: matchedShipment?.transporter ?? ocrFields.transporter_name ?? null,
      consigneeName: ocrFields.consignee_name ?? matchedShipment?.consigneeName ?? null,
      statusLabel: classification.statusLabel,
      statusVariant: classification.statusVariant,
      reason: classification.reason,
      confidence,
      confidenceLabel: getConfidenceLabel(confidence),
      stampPresent: ocrFields.stamp_present,
      signaturePresent: ocrFields.signature_present,
      ocrFields,
    });
  }

  // Build summary
  const summary = {
    totalAwbs: selectedAwbs?.length ?? items.length,
    totalUploadedImages: files.length,
    matchedCount: items.filter(i => i.statusLabel === 'Matched').length,
    needsReviewCount: items.filter(i => i.statusLabel === 'Needs Review').length,
    skippedCount: items.filter(i => i.statusLabel === 'Skipped').length,
    unmappedCount: items.filter(i => i.statusLabel === 'Unmapped').length,
  };

  return { summary, items };
}
