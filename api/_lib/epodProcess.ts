import { extractFieldsFromFile, type EpodOcrResult } from './openaiOcr.js';
import { findShipmentByAwb, normalizeAwb, type ShipmentRecord } from './shipmentMaster.js';

export interface ProcessedItem {
  id: string;
  processingMode?: 'bulk' | 'selection';
  bucket?: 'matched' | 'needs_review' | 'unmapped' | 'skipped';
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
  invoiceNumberExtracted?: string | null;
  invoiceNumberSystem?: string | null;
  sentQty?: number | null;
  receivedQty?: number | null;
  difference?: number | null;
  deliveryReviewStatus?: 'clean' | 'unclean' | null;
  systemData: {
    awbNumber: string | null;
    shipmentId: string | null;
    fromName: string | null;
    fromSubtext: string | null;
    toName: string | null;
    toSubtext: string | null;
    transporter: string | null;
    deliveredDate: string | null;
    packages: number | null;
  };
  ocrData: {
    extractedAwb: string | null;
    extractedConsignee: string | null;
    extractedDeliveryDate: string | null;
    extractedFrom: string | null;
    extractedTo: string | null;
    stampPresent: boolean;
    signaturePresent: boolean;
    remarks: string | null;
    conditionNotes: string | null;
    description: string | null;
    packages: number | null;
    rawFields: EpodOcrResult;
  };
  lineItems: Array<{
    id: string;
    sku: string | null;
    description: string;
    sentQty: number;
    receivedQty: number;
    damagedQty: number;
    difference: number;
    reconStatus: 'MATCH' | 'SHORT' | 'EXCESS' | 'DAMAGED';
    reviewAction?: 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN';
    note?: string | null;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    resolved: boolean;
  }>;
  auditTrail: Array<{
    id: string;
    timestamp: string;
    actor: string;
    description: string;
  }>;
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
  _fileName: string,
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

  const missingSystemFields = [
    !matchedShipment.shipmentId && 'shipment id',
    !matchedShipment.origin && 'from',
    !matchedShipment.consigneeName && 'to name',
    !matchedShipment.destination && 'to city',
    !matchedShipment.transporter && 'transporter',
  ].filter(Boolean) as string[];

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

  if (missingSystemFields.length > 0) {
    return {
      statusLabel: 'Needs Review',
      statusVariant: 'warning',
      reason: `Incomplete shipment data: missing ${missingSystemFields.join(', ')}`,
    };
  }

  if (extracted.invoice_number && matchedShipment.shipmentId && !extracted.invoice_number.includes(extractedAwb)) {
    return { statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Invoice details need manual verification' };
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

function mapBucket(statusLabel: ProcessedItem['statusLabel']): NonNullable<ProcessedItem['bucket']> {
  switch (statusLabel) {
    case 'Matched':
      return 'matched';
    case 'Needs Review':
      return 'needs_review';
    case 'Skipped':
      return 'skipped';
    default:
      return 'unmapped';
  }
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

function countMatchedAwbs(items: ProcessedItem[]): number {
  return new Set(
    items
      .filter((item) => item.statusLabel !== 'Unmapped' && Boolean(item.awbNumber))
      .map((item) => normalizeAwb(item.awbNumber as string)),
  ).size;
}

function buildLineItems(
  matchedShipment: ShipmentRecord | null,
  extracted: EpodOcrResult,
  fileName: string,
) {
  const sentQty = matchedShipment?.packageCount ?? extracted.no_of_packages ?? 0;
  const receivedQty = extracted.no_of_packages ?? sentQty;
  const remarks = `${extracted.remarks || ''} ${extracted.condition_notes || ''}`.toLowerCase();
  const damagedQty = /damage|broken|torn|wet|crushed/.test(remarks) ? 1 : 0;
  const difference = receivedQty - sentQty;
  let reconStatus: 'MATCH' | 'SHORT' | 'EXCESS' | 'DAMAGED' = 'MATCH';

  if (damagedQty > 0) {
    reconStatus = 'DAMAGED';
  } else if (difference < 0) {
    reconStatus = 'SHORT';
  } else if (difference > 0) {
    reconStatus = 'EXCESS';
  }

  return [{
    id: `${fileName}-line-1`,
    sku: extracted.invoice_number ?? matchedShipment?.shipmentId ?? null,
    description: extracted.description || 'POD package line',
    sentQty,
    receivedQty,
    damagedQty,
    difference,
    reconStatus,
  }];
}

function buildExceptions(
  classification: { statusLabel: ProcessedItem['statusLabel']; reason: string },
  extracted: EpodOcrResult,
  lineItems: ReturnType<typeof buildLineItems>,
) {
  const exceptions: ProcessedItem['exceptions'] = [];
  const remarks = `${extracted.remarks || ''} ${extracted.condition_notes || ''}`.toLowerCase();

  if (classification.statusLabel === 'Unmapped') {
    exceptions.push({
      id: 'ex-unmapped',
      type: 'UNMATCHED_POD',
      severity: 'HIGH',
      description: classification.reason,
      resolved: false,
    });
  }
  if (classification.statusLabel === 'Skipped') {
    exceptions.push({
      id: 'ex-skipped',
      type: 'MISMATCH_ERROR',
      severity: 'HIGH',
      description: classification.reason,
      resolved: false,
    });
  }
  if (!extracted.stamp_present) {
    exceptions.push({
      id: 'ex-stamp',
      type: 'STAMP_MISSING',
      severity: 'MEDIUM',
      description: 'Consignee stamp not detected',
      resolved: false,
    });
  }
  if (!extracted.signature_present) {
    exceptions.push({
      id: 'ex-signature',
      type: 'SIGNATURE_MISSING',
      severity: 'MEDIUM',
      description: 'Receiver signature not detected',
      resolved: false,
    });
  }
  if (lineItems.some((line) => line.reconStatus === 'SHORT')) {
    exceptions.push({
      id: 'ex-short',
      type: 'SHORT_DELIVERY',
      severity: 'HIGH',
      description: 'Received quantity is lower than planned quantity',
      resolved: false,
    });
  }
  if (lineItems.some((line) => line.reconStatus === 'DAMAGED') || /damage|broken|torn|wet|crushed/.test(remarks)) {
    exceptions.push({
      id: 'ex-damaged',
      type: 'DAMAGED_ITEMS',
      severity: 'HIGH',
      description: 'Damage indicators detected in remarks or condition notes',
      resolved: false,
    });
  }

  return exceptions;
}

function buildAuditTrail(fileName: string, actor: string, classification: { statusLabel: ProcessedItem['statusLabel']; reason: string }) {
  const timestamp = new Date().toISOString();
  return [
    {
      id: `${fileName}-audit-upload`,
      timestamp,
      actor,
      description: 'File uploaded for ePOD processing',
    },
    {
      id: `${fileName}-audit-ocr`,
      timestamp,
      actor: 'system',
      description: 'OCR extraction completed',
    },
    {
      id: `${fileName}-audit-classification`,
      timestamp,
      actor: 'system',
      description: `Item classified as ${classification.statusLabel}: ${classification.reason}`,
    },
  ];
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

    // 3. Classify
    const classification = classifyItem(ocrFields, confidence, matchedShipment, selectedAwbs, file.name);
    const lineItems = buildLineItems(matchedShipment, ocrFields, file.name);
    const exceptions = buildExceptions(classification, ocrFields, lineItems);
    const systemData = {
      awbNumber: matchedShipment?.awbNumber ?? null,
      shipmentId: matchedShipment?.shipmentId ?? null,
      fromName: matchedShipment?.origin ?? null,
      fromSubtext: matchedShipment?.originCity ?? null,
      toName: matchedShipment?.consigneeName ?? null,
      toSubtext: matchedShipment?.destination ?? null,
      transporter: matchedShipment?.transporter ?? null,
      deliveredDate: matchedShipment?.deliveredDate ?? null,
      packages: matchedShipment?.packageCount ?? null,
    };
    const ocrData = {
      extractedAwb: ocrFields.awb_number,
      extractedConsignee: ocrFields.consignee_name,
      extractedDeliveryDate: ocrFields.delivery_date,
      extractedFrom: ocrFields.consignor_name ?? ocrFields.from_city,
      extractedTo: ocrFields.consignee_name ?? ocrFields.to_city,
      stampPresent: ocrFields.stamp_present,
      signaturePresent: ocrFields.signature_present,
      remarks: ocrFields.remarks,
      conditionNotes: ocrFields.condition_notes,
      description: ocrFields.description,
      packages: ocrFields.no_of_packages,
      rawFields: ocrFields,
    };

    // 4. Build display row
    items.push({
      id: `item-${i}-${Date.now()}`,
      processingMode: 'bulk',
      bucket: mapBucket(classification.statusLabel),
      fileName: file.name,
      awbNumber: ocrFields.awb_number ?? null,
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
      invoiceNumberExtracted: ocrFields.invoice_number ?? null,
      invoiceNumberSystem: matchedShipment ? `INV-${matchedShipment.awbNumber}` : null,
      sentQty: lineItems[0]?.sentQty ?? null,
      receivedQty: lineItems[0]?.receivedQty ?? null,
      difference: lineItems[0]?.difference ?? null,
      deliveryReviewStatus: null,
      systemData,
      ocrData,
      lineItems,
      exceptions,
      auditTrail: buildAuditTrail(file.name, 'system', classification),
      ocrFields,
    });
  }

  // Build summary
  const summary = {
    totalAwbs: selectedAwbs && selectedAwbs.length > 0 ? selectedAwbs.length : countMatchedAwbs(items),
    totalUploadedImages: files.length,
    matchedCount: items.filter(i => i.statusLabel === 'Matched').length,
    needsReviewCount: items.filter(i => i.statusLabel === 'Needs Review').length,
    skippedCount: items.filter(i => i.statusLabel === 'Skipped').length,
    unmappedCount: items.filter(i => i.statusLabel === 'Unmapped').length,
  };

  return { summary, items };
}
