import extractedPodRecords from '@/data/epodExtractedData.json';
import type {
  EpodDeliveryReviewStatus,
  EpodExtractedPodData,
  EpodExtractedPodRecord,
  EpodSelectedFlowReviewMeta,
  EpodSelectedFlowReviewVariant,
  EpodSelectedShipment,
} from '@/lib/epod/types';
import type {
  EpodProcessResult,
  ProcessedAuditEvent,
  ProcessedException,
  ProcessedItem,
  ProcessedLineItem,
} from '@/lib/epodApi';

interface SelectedFlowInput {
  files: File[];
  selectedShipments: EpodSelectedShipment[];
  actor?: string;
  delayMs?: number;
}

type ReviewPreset =
  | { variant: 'clean' }
  | { variant: 'stamp_missing' }
  | { variant: 'signature_missing' }
  | { variant: 'quantity_mismatch'; quantityDelta: number }
  | { variant: 'invoice_mismatch'; invoiceSuffix: string; invoiceValueDelta: number }
  | {
      variant: 'partial_extraction';
      omitDeliveryDate?: boolean;
      truncateConsignee?: boolean;
      truncateFrom?: boolean;
      truncateTo?: boolean;
    };

type SelectedFlowProcessedItem = ProcessedItem & {
  processingMode: 'selection';
  reviewMeta: EpodSelectedFlowReviewMeta & {
    reviewVariant: EpodSelectedFlowReviewVariant;
  };
  ocrData: ProcessedItem['ocrData'] & {
    deliveryReviewStatus?: EpodDeliveryReviewStatus;
  };
};

const REPORT_RECORDS = extractedPodRecords as EpodExtractedPodRecord[];

function normalizeAwb(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.55) return 'Medium';
  return 'Low';
}

function partialText(value: string | null | undefined, keepWords = 1): string | null {
  if (!value) {
    return null;
  }

  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }

  return words.slice(0, Math.max(1, keepWords)).join(' ');
}

function buildRecordMaps() {
  const byFileName = new Map<string, EpodExtractedPodRecord>();
  const byAwb = new Map<string, EpodExtractedPodRecord>();

  REPORT_RECORDS.forEach((record) => {
    byFileName.set(record.fileName.toLowerCase(), record);
    const awb = normalizeAwb(record.extractedData.awb_number);
    if (awb) {
      byAwb.set(awb, record);
    }
  });

  return { byFileName, byAwb };
}

function buildShipmentMap(records: EpodSelectedShipment[]) {
  return new Map(records.map((record) => [normalizeAwb(record.awbNumber), record] as const));
}

function resolveReportRecord(
  file: File,
  recordMaps: ReturnType<typeof buildRecordMaps>,
): EpodExtractedPodRecord | null {
  const direct = recordMaps.byFileName.get(file.name.toLowerCase());
  if (direct) {
    return direct;
  }

  const stem = normalizeAwb(fileStem(file.name));
  if (stem) {
    return recordMaps.byAwb.get(stem) ?? null;
  }

  return null;
}

function resolveReviewPreset(record: EpodExtractedPodRecord, index: number): ReviewPreset {
  const awbTail = Number(normalizeAwb(record.extractedData.awb_number).slice(-1)) || 0;
  const slot = (index + awbTail) % 6;

  switch (slot) {
    case 1:
      return { variant: 'stamp_missing' };
    case 2:
      return { variant: 'signature_missing' };
    case 3:
      return { variant: 'quantity_mismatch', quantityDelta: awbTail % 2 === 0 ? -1 : 1 };
    case 4:
      if (record.extractedData.invoice_number || record.extractedData.invoice_value !== null) {
        return {
          variant: 'invoice_mismatch',
          invoiceSuffix: '-REV',
          invoiceValueDelta: record.extractedData.invoice_value !== null ? 10 : 0,
        };
      }
      return {
        variant: 'partial_extraction',
        omitDeliveryDate: true,
        truncateConsignee: true,
      };
    case 5:
      return {
        variant: 'partial_extraction',
        omitDeliveryDate: true,
        truncateFrom: true,
        truncateTo: true,
      };
    default:
      return { variant: 'clean' };
  }
}

function applyReviewPreset(
  extracted: EpodExtractedPodData,
  preset: ReviewPreset,
): {
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
  invoiceNumber: string | null;
  invoiceValue: number | null;
  rawFields: Record<string, unknown>;
  reviewVariant: EpodSelectedFlowReviewVariant;
} {
  const reviewVariant = preset.variant;
  const extractedAwb = extracted.awb_number ?? null;
  let extractedConsignee = extracted.consignee_name ?? null;
  let extractedDeliveryDate = extracted.delivery_date ?? null;
  let extractedFrom = extracted.consignor_name ?? null;
  let extractedTo = extracted.consignee_name ?? extracted.to_city ?? null;
  let stampPresent = extracted.stamp_present;
  let signaturePresent = extracted.signature_present;
  let packages = extracted.no_of_packages ?? null;
  let invoiceNumber = extracted.invoice_number ?? null;
  let invoiceValue = extracted.invoice_value ?? null;
  let remarks = extracted.remarks ?? null;
  let conditionNotes = extracted.condition_notes ?? null;

  switch (preset.variant) {
    case 'stamp_missing':
      stampPresent = false;
      conditionNotes = conditionNotes ?? 'Consignee stamp is not clearly visible in the uploaded image';
      break;
    case 'signature_missing':
      signaturePresent = false;
      conditionNotes = conditionNotes ?? 'Receiver signature is not clearly visible in the uploaded image';
      break;
    case 'quantity_mismatch':
      if (packages !== null) {
        packages = Math.max(0, packages + preset.quantityDelta);
      }
      conditionNotes = conditionNotes ?? 'Package count needs manual verification';
      break;
    case 'invoice_mismatch':
      if (invoiceNumber) {
        invoiceNumber = `${invoiceNumber}${preset.invoiceSuffix}`;
      }
      if (invoiceValue !== null) {
        invoiceValue = invoiceValue + preset.invoiceValueDelta;
      }
      remarks = remarks ?? 'Invoice reference needs manual verification';
      break;
    case 'partial_extraction':
      if (preset.omitDeliveryDate) {
        extractedDeliveryDate = null;
      }
      if (preset.truncateConsignee) {
        extractedConsignee = partialText(extractedConsignee, 1);
      }
      if (preset.truncateFrom) {
        extractedFrom = partialText(extractedFrom, 1);
      }
      if (preset.truncateTo) {
        extractedTo = partialText(extractedTo, 1);
      }
      remarks = remarks ?? 'OCR fields are partially obscured and need review';
      break;
    default:
      break;
  }

  return {
    extractedAwb,
    extractedConsignee,
    extractedDeliveryDate,
    extractedFrom,
    extractedTo,
    stampPresent,
    signaturePresent,
    remarks,
    conditionNotes,
    description: extracted.description,
    packages,
    invoiceNumber,
    invoiceValue,
    reviewVariant,
    rawFields: {
      ...extracted,
      awb_number: extractedAwb,
      consignee_name: extractedConsignee,
      delivery_date: extractedDeliveryDate,
      consignor_name: extractedFrom,
      extracted_to: extractedTo,
      stamp_present: stampPresent,
      signature_present: signaturePresent,
      no_of_packages: packages,
      invoice_number: invoiceNumber,
      invoice_value: invoiceValue,
      review_variant: reviewVariant,
      partial_extraction:
        preset.variant === 'partial_extraction'
          ? {
              omitDeliveryDate: Boolean(preset.omitDeliveryDate),
              truncateConsignee: Boolean(preset.truncateConsignee),
              truncateFrom: Boolean(preset.truncateFrom),
              truncateTo: Boolean(preset.truncateTo),
            }
          : null,
    },
  };
}

function compareShipmentAndExtraction(
  shipment: EpodSelectedShipment,
  extracted: ReturnType<typeof applyReviewPreset>,
): string[] {
  const reasons = new Set<string>();

  const shipmentConsignee = normalizeText(shipment.consigneeName);
  const shipmentOrigin = normalizeText(shipment.origin);
  const shipmentDestination = normalizeText(shipment.destination);
  const extractedConsignee = normalizeText(extracted.extractedConsignee);
  const extractedFrom = normalizeText(extracted.extractedFrom);
  const extractedTo = normalizeText(extracted.extractedTo);
  const extractedDeliveryDate = normalizeText(extracted.extractedDeliveryDate);
  const shipmentDeliveredDate = normalizeText(shipment.deliveredDate);

  if (!extracted.extractedAwb || normalizeAwb(extracted.extractedAwb) !== normalizeAwb(shipment.awbNumber)) {
    reasons.add('AWB extracted from image does not match the selected shipment');
  }

  if (shipmentConsignee && extractedConsignee && shipmentConsignee !== extractedConsignee) {
    reasons.add('Consignee name differs from the shipment master');
  }

  if (shipmentOrigin && extractedFrom && shipmentOrigin !== extractedFrom) {
    reasons.add('From location differs from the shipment master');
  }

  if (shipmentDestination && extractedTo && shipmentDestination !== extractedTo) {
    reasons.add('To location differs from the shipment master');
  }

  if (shipmentDeliveredDate) {
    if (!extractedDeliveryDate) {
      reasons.add('Delivery date is missing or unclear in OCR extraction');
    } else if (shipmentDeliveredDate !== extractedDeliveryDate) {
      reasons.add('Delivery date differs from the shipment master');
    }
  }

  if (!extracted.stampPresent) {
    reasons.add('Consignee stamp is missing or unclear in the uploaded image');
  }

  if (!extracted.signaturePresent) {
    reasons.add('Receiver signature is missing or unclear in the uploaded image');
  }

  const sentQty = shipment.packageCount ?? null;
  const receivedQty = extracted.packages ?? null;
  if (sentQty !== null && receivedQty !== null && sentQty !== receivedQty) {
    reasons.add(`Package count mismatch: shipment expects ${sentQty} and POD shows ${receivedQty}`);
  }

  const invoiceNumberOriginal = extracted.rawFields.invoice_number as string | null | undefined;
  const invoiceNumberExtracted = extracted.invoiceNumber;
  const invoiceValueOriginal = extracted.rawFields.invoice_value as number | null | undefined;
  const invoiceValueExtracted = extracted.invoiceValue;
  if (
    (invoiceNumberOriginal && invoiceNumberExtracted && invoiceNumberOriginal !== invoiceNumberExtracted) ||
    (invoiceValueOriginal !== null && invoiceValueOriginal !== undefined && invoiceValueExtracted !== invoiceValueOriginal)
  ) {
    reasons.add('Invoice number or value differs from the stored extracted review values');
  }

  if (extracted.reviewVariant === 'partial_extraction') {
    reasons.add('OCR fields are partially missing and need manual verification');
  }

  return Array.from(reasons);
}

function buildLineItems(
  shipment: EpodSelectedShipment,
  extracted: ReturnType<typeof applyReviewPreset>,
): ProcessedLineItem[] {
  const sentQty = shipment.packageCount ?? extracted.packages ?? 0;
  const receivedQty = extracted.packages ?? sentQty;
  const damagedQty = (extracted.remarks ?? extracted.conditionNotes ?? '').toLowerCase().match(/damag|broken|leak/i) ? 1 : 0;
  const difference = receivedQty - sentQty;

  let reconStatus: ProcessedLineItem['reconStatus'] = 'MATCH';
  if (damagedQty > 0) {
    reconStatus = 'DAMAGED';
  } else if (difference < 0) {
    reconStatus = 'SHORT';
  } else if (difference > 0) {
    reconStatus = 'EXCESS';
  }

  return [
    {
      id: `${shipment.awbNumber}-line-1`,
      sku: extracted.rawFields.docket_number ? String(extracted.rawFields.docket_number) : null,
      description: extracted.description ?? 'POD package line',
      sentQty,
      receivedQty,
      damagedQty,
      difference,
      reconStatus,
      reviewAction: reconStatus === 'MATCH' ? 'ACCEPTED' : undefined,
      note:
        reconStatus === 'MATCH'
          ? null
          : 'Line item quantities need to be verified against the uploaded POD image',
    },
  ];
}

function buildExceptions(
  statusLabel: ProcessedItem['statusLabel'],
  discrepancyReasons: string[],
  extracted: ReturnType<typeof applyReviewPreset>,
  lineItems: ProcessedLineItem[],
  duplicateUpload: boolean,
): ProcessedException[] {
  const exceptions: ProcessedException[] = [];

  if (statusLabel === 'Skipped') {
    exceptions.push({
      id: `ex-skip-${normalizeAwb(extracted.extractedAwb) || 'missing'}`,
      type: 'NO_IMAGE_UPLOADED',
      severity: 'HIGH',
      description: 'No uploaded image was mapped to this selected AWB',
      resolved: false,
    });
  }

  if (duplicateUpload) {
    exceptions.push({
      id: `ex-duplicate-${normalizeAwb(extracted.extractedAwb) || 'missing'}`,
      type: 'DUPLICATE_UPLOAD',
      severity: 'HIGH',
      description: 'A second uploaded image mapped to the same selected AWB',
      resolved: false,
    });
  }

  discrepancyReasons.forEach((reason, index) => {
    const lower = reason.toLowerCase();
    const isHigh = /awb|missing image|delivery date differs|package count mismatch|duplicate/.test(lower);
    exceptions.push({
      id: `ex-${normalizeAwb(extracted.extractedAwb) || 'missing'}-${index}`,
      type: lower.includes('stamp')
        ? 'STAMP_MISSING'
        : lower.includes('signature')
          ? 'SIGNATURE_MISSING'
          : lower.includes('invoice')
            ? 'INVOICE_MISMATCH'
            : lower.includes('partial')
              ? 'PARTIAL_EXTRACTION'
              : lower.includes('package count')
                ? 'SHORT_DELIVERY'
                : lower.includes('delivery date')
                  ? 'DELIVERY_DATE_MISMATCH'
                  : lower.includes('consignee') || lower.includes('from location') || lower.includes('to location')
                    ? 'FIELD_MISMATCH'
                    : lower.includes('awb')
                      ? 'AWB_MISMATCH'
                      : 'REVIEW_REQUIRED',
      severity: isHigh ? 'HIGH' : 'MEDIUM',
      description: reason,
      resolved: false,
    });
  });

  if (lineItems.some((line) => line.reconStatus === 'SHORT')) {
    exceptions.push({
      id: `ex-short-${normalizeAwb(extracted.extractedAwb) || 'missing'}`,
      type: 'SHORT_DELIVERY',
      severity: 'HIGH',
      description: 'Received quantity is lower than the shipment quantity',
      resolved: false,
    });
  }

  if (lineItems.some((line) => line.reconStatus === 'EXCESS')) {
    exceptions.push({
      id: `ex-excess-${normalizeAwb(extracted.extractedAwb) || 'missing'}`,
      type: 'EXCESS_QUANTITY',
      severity: 'MEDIUM',
      description: 'Received quantity is higher than the shipment quantity',
      resolved: false,
    });
  }

  if (lineItems.some((line) => line.reconStatus === 'DAMAGED')) {
    exceptions.push({
      id: `ex-damaged-${normalizeAwb(extracted.extractedAwb) || 'missing'}`,
      type: 'DAMAGED_ITEMS',
      severity: 'HIGH',
      description: 'Damage indicators were detected in the POD notes',
      resolved: false,
    });
  }

  return exceptions;
}

function buildAuditTrail(
  fileName: string,
  shipmentAwb: string | null,
  actor: string,
  statusLabel: ProcessedItem['statusLabel'],
  reviewStatus: EpodDeliveryReviewStatus,
  reviewVariant: EpodSelectedFlowReviewVariant,
): ProcessedAuditEvent[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: `${fileName}-audit-load`,
      timestamp,
      actor,
      description: `Loaded stored extracted POD data for ${shipmentAwb ?? 'unmapped file'}`,
    },
    {
      id: `${fileName}-audit-review`,
      timestamp,
      actor: 'system',
      description: `Selected-AWB flow classified as ${statusLabel}${reviewStatus ? ` (${reviewStatus})` : ''} using ${reviewVariant} review shaping`,
    },
  ];
}

function buildMatchedItem(
  file: File,
  record: EpodExtractedPodRecord,
  shipment: EpodSelectedShipment,
  actor: string,
  preset: ReviewPreset,
  duplicateUpload: boolean,
): SelectedFlowProcessedItem {
  const extracted = applyReviewPreset(record.extractedData, preset);
  const discrepancyReasons = compareShipmentAndExtraction(shipment, extracted);
  if (duplicateUpload) {
    discrepancyReasons.unshift('Duplicate upload for the selected AWB');
  }

  const lineItems = buildLineItems(shipment, extracted);
  const hasIssues = discrepancyReasons.length > 0;
  const statusLabel: ProcessedItem['statusLabel'] = hasIssues ? 'Needs Review' : 'Matched';
  const statusVariant: ProcessedItem['statusVariant'] = hasIssues ? 'warning' : 'success';
  const reason = hasIssues
    ? discrepancyReasons.join('; ')
    : 'AWB matched with document-backed shipment data';
  const confidence = hasIssues ? Math.max(0.56, 0.9 - discrepancyReasons.length * 0.08) : 0.96;
  const reviewStatus: EpodDeliveryReviewStatus = null;

  const ocrData: ProcessedItem['ocrData'] & { deliveryReviewStatus?: EpodDeliveryReviewStatus } = {
    extractedAwb: extracted.extractedAwb,
    extractedConsignee: extracted.extractedConsignee,
    extractedDeliveryDate: extracted.extractedDeliveryDate,
    extractedFrom: extracted.extractedFrom,
    extractedTo: extracted.extractedTo,
    stampPresent: extracted.stampPresent,
    signaturePresent: extracted.signaturePresent,
    remarks: extracted.remarks,
    conditionNotes: extracted.conditionNotes,
    description: extracted.description,
    packages: extracted.packages,
    rawFields: {
      ...extracted.rawFields,
      processing_mode: 'selection',
      delivery_review_status: reviewStatus,
      review_variant: extracted.reviewVariant,
      review_reasons: discrepancyReasons,
      matched_awb: shipment.awbNumber,
      selected_awb: shipment.awbNumber,
      source_file_name: file.name,
      document_backed: true,
    },
    deliveryReviewStatus: reviewStatus,
  };

  return {
    id: `selection-${shipment.awbNumber}`,
    processingMode: 'selection',
    bucket: statusLabel === 'Matched' ? 'matched' : 'needs_review',
    fileName: file.name,
    awbNumber: shipment.awbNumber,
    shipmentId: shipment.shipmentId,
    fromName: shipment.origin,
    fromSubtext: shipment.originCity,
    toName: shipment.consigneeName,
    toSubtext: shipment.destination,
    transporter: shipment.transporter,
    statusLabel,
    statusVariant,
    reason,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    stampPresent: extracted.stampPresent,
    signaturePresent: extracted.signaturePresent,
    invoiceNumberExtracted: extracted.invoiceNumber,
    invoiceNumberSystem: null,
    sentQty: shipment.packageCount,
    receivedQty: extracted.packages,
    difference: extracted.packages !== null ? extracted.packages - shipment.packageCount : null,
    deliveryReviewStatus: reviewStatus,
    systemData: {
      awbNumber: shipment.awbNumber,
      shipmentId: shipment.shipmentId,
      fromName: shipment.origin,
      fromSubtext: shipment.originCity,
      toName: shipment.consigneeName,
      toSubtext: shipment.destination,
      transporter: shipment.transporter,
      deliveredDate: shipment.deliveredDate,
      packages: shipment.packageCount,
    },
    ocrData,
    lineItems,
    exceptions: buildExceptions(statusLabel, discrepancyReasons, extracted, lineItems, duplicateUpload),
    auditTrail: buildAuditTrail(file.name, shipment.awbNumber, actor, statusLabel, reviewStatus, extracted.reviewVariant),
    ocrFields: {
      ...extracted.rawFields,
      processing_mode: 'selection',
      delivery_review_status: reviewStatus,
      review_variant: extracted.reviewVariant,
      review_reasons: discrepancyReasons,
      matched_awb: shipment.awbNumber,
      selected_awb: shipment.awbNumber,
      source_file_name: file.name,
      document_backed: true,
    },
    reviewMeta: {
      processingMode: 'selection',
      reviewVariant: extracted.reviewVariant,
      matchedAwb: shipment.awbNumber,
      invoiceNumberOriginal: record.extractedData.invoice_number ?? null,
      invoiceNumberExtracted: extracted.invoiceNumber,
      invoiceValueOriginal: record.extractedData.invoice_value ?? null,
      invoiceValueExtracted: extracted.invoiceValue,
      packageCountOriginal: record.extractedData.no_of_packages ?? null,
      packageCountExtracted: extracted.packages,
      stampPresentOriginal: record.extractedData.stamp_present,
      stampPresentExtracted: extracted.stampPresent,
      signaturePresentOriginal: record.extractedData.signature_present,
      signaturePresentExtracted: extracted.signaturePresent,
      deliveryReviewStatus: reviewStatus,
      discrepancyReasons,
    },
  };
}

function buildUnmappedItem(file: File, actor: string, reason: string): SelectedFlowProcessedItem {
  const timestamp = new Date().toISOString();
  const reviewStatus: EpodDeliveryReviewStatus = null;
  return {
    id: `selection-unmapped-${file.name}`,
    processingMode: 'selection',
    bucket: 'unmapped',
    fileName: file.name,
    awbNumber: null,
    shipmentId: null,
    fromName: null,
    fromSubtext: null,
    toName: null,
    toSubtext: null,
    transporter: null,
    statusLabel: 'Unmapped',
    statusVariant: 'danger',
    reason,
    confidence: 0.25,
    confidenceLabel: 'Low',
    stampPresent: false,
    signaturePresent: false,
    invoiceNumberExtracted: null,
    invoiceNumberSystem: null,
    sentQty: null,
    receivedQty: null,
    difference: null,
    deliveryReviewStatus: reviewStatus,
    systemData: {
      awbNumber: null,
      shipmentId: null,
      fromName: null,
      fromSubtext: null,
      toName: null,
      toSubtext: null,
      transporter: null,
      deliveredDate: null,
      packages: null,
    },
    ocrData: {
      extractedAwb: null,
      extractedConsignee: null,
      extractedDeliveryDate: null,
      extractedFrom: null,
      extractedTo: null,
      stampPresent: false,
      signaturePresent: false,
      remarks: null,
      conditionNotes: null,
      description: null,
      packages: null,
      rawFields: {
        processing_mode: 'selection',
        delivery_review_status: reviewStatus,
        review_reasons: ['UNMATCHED_POD'],
        file_name: file.name,
        document_backed: false,
      },
      deliveryReviewStatus: reviewStatus,
    },
    lineItems: [],
    exceptions: [
      {
        id: `unmapped-${file.name}`,
        type: 'UNMATCHED_POD',
        severity: 'HIGH',
        description: reason,
        resolved: false,
      },
    ],
    auditTrail: [
      {
        id: `unmapped-${file.name}-audit-upload`,
        timestamp,
        actor,
        description: `Uploaded ${file.name}`,
      },
      {
        id: `unmapped-${file.name}-audit-classify`,
        timestamp,
        actor: 'system',
        description: reason,
      },
    ],
    ocrFields: {
      processing_mode: 'selection',
      delivery_review_status: reviewStatus,
      review_reasons: ['UNMATCHED_POD'],
      file_name: file.name,
      document_backed: false,
    },
    reviewMeta: {
      processingMode: 'selection',
      reviewVariant: 'not_applicable',
      matchedAwb: null,
      invoiceNumberOriginal: null,
      invoiceNumberExtracted: null,
      invoiceValueOriginal: null,
      invoiceValueExtracted: null,
      packageCountOriginal: null,
      packageCountExtracted: null,
      stampPresentOriginal: false,
      stampPresentExtracted: false,
      signaturePresentOriginal: false,
      signaturePresentExtracted: false,
      deliveryReviewStatus: reviewStatus,
      discrepancyReasons: [reason],
    },
  };
}

function buildSkippedItem(shipment: EpodSelectedShipment, actor: string): SelectedFlowProcessedItem {
  const timestamp = new Date().toISOString();
  const reason = 'No uploaded image mapped to this selected AWB';
  const reviewStatus: EpodDeliveryReviewStatus = null;
  return {
    id: `selection-skipped-${shipment.awbNumber}`,
    processingMode: 'selection',
    bucket: 'skipped',
    fileName: `No image uploaded for ${shipment.awbNumber}`,
    awbNumber: shipment.awbNumber,
    shipmentId: shipment.shipmentId,
    fromName: shipment.origin,
    fromSubtext: shipment.originCity,
    toName: shipment.consigneeName,
    toSubtext: shipment.destination,
    transporter: shipment.transporter,
    statusLabel: 'Skipped',
    statusVariant: 'danger',
    reason,
    confidence: 0.1,
    confidenceLabel: 'Low',
    stampPresent: true,
    signaturePresent: true,
    invoiceNumberExtracted: null,
    invoiceNumberSystem: null,
    sentQty: shipment.packageCount,
    receivedQty: null,
    difference: null,
    deliveryReviewStatus: reviewStatus,
    systemData: {
      awbNumber: shipment.awbNumber,
      shipmentId: shipment.shipmentId,
      fromName: shipment.origin,
      fromSubtext: shipment.originCity,
      toName: shipment.consigneeName,
      toSubtext: shipment.destination,
      transporter: shipment.transporter,
      deliveredDate: shipment.deliveredDate,
      packages: shipment.packageCount,
    },
    ocrData: {
      extractedAwb: null,
      extractedConsignee: null,
      extractedDeliveryDate: null,
      extractedFrom: null,
      extractedTo: null,
      stampPresent: false,
      signaturePresent: false,
      remarks: null,
      conditionNotes: null,
      description: null,
      packages: null,
      rawFields: {
        processing_mode: 'selection',
        delivery_review_status: reviewStatus,
        review_reasons: ['MISSING_UPLOADED_IMAGE'],
        matched_awb: shipment.awbNumber,
        document_backed: true,
      },
      deliveryReviewStatus: reviewStatus,
    },
    lineItems: [],
    exceptions: [
      {
        id: `skipped-${shipment.awbNumber}`,
        type: 'MISSING_UPLOADED_IMAGE',
        severity: 'HIGH',
        description: reason,
        resolved: false,
      },
    ],
    auditTrail: [
      {
        id: `skipped-${shipment.awbNumber}-audit-upload`,
        timestamp,
        actor,
        description: `Expected file for ${shipment.awbNumber} was not uploaded`,
      },
      {
        id: `skipped-${shipment.awbNumber}-audit-classify`,
        timestamp,
        actor: 'system',
        description: reason,
      },
    ],
    ocrFields: {
      processing_mode: 'selection',
      delivery_review_status: reviewStatus,
      review_reasons: ['MISSING_UPLOADED_IMAGE'],
      matched_awb: shipment.awbNumber,
      document_backed: true,
    },
    reviewMeta: {
      processingMode: 'selection',
      reviewVariant: 'not_applicable',
      matchedAwb: shipment.awbNumber,
      invoiceNumberOriginal: null,
      invoiceNumberExtracted: null,
      invoiceValueOriginal: null,
      invoiceValueExtracted: null,
      packageCountOriginal: shipment.packageCount,
      packageCountExtracted: null,
      stampPresentOriginal: true,
      stampPresentExtracted: false,
      signaturePresentOriginal: true,
      signaturePresentExtracted: false,
      deliveryReviewStatus: reviewStatus,
      discrepancyReasons: [reason],
    },
  };
}

function buildDuplicateItem(
  file: File,
  record: EpodExtractedPodRecord,
  shipment: EpodSelectedShipment,
  actor: string,
): SelectedFlowProcessedItem {
  const duplicateReason = 'Duplicate upload for the selected AWB';
  const matchedItem = buildMatchedItem(file, record, shipment, actor, { variant: 'clean' }, false);
  const extracted = applyReviewPreset(record.extractedData, { variant: 'clean' });
  const reviewStatus: EpodDeliveryReviewStatus = null;
  const lineItems = buildLineItems(shipment, extracted);
  return {
    ...matchedItem,
    bucket: 'needs_review',
    statusLabel: 'Needs Review',
    statusVariant: 'warning',
    reason: duplicateReason,
    confidence: 0.58,
    confidenceLabel: 'Medium',
    deliveryReviewStatus: reviewStatus,
    ocrData: {
      ...(matchedItem.ocrData as ProcessedItem['ocrData']),
      deliveryReviewStatus: reviewStatus,
      rawFields: {
        ...(matchedItem.ocrData.rawFields ?? {}),
        processing_mode: 'selection',
        delivery_review_status: reviewStatus,
        review_variant: 'duplicate_upload',
        review_reasons: [duplicateReason],
        matched_awb: shipment.awbNumber,
        selected_awb: shipment.awbNumber,
        source_file_name: file.name,
        document_backed: true,
      },
    },
    lineItems,
    exceptions: buildExceptions('Needs Review', [duplicateReason], extracted, lineItems, true),
    reviewMeta: {
      processingMode: 'selection',
      reviewVariant: 'duplicate_upload',
      matchedAwb: shipment.awbNumber,
      invoiceNumberOriginal: record.extractedData.invoice_number ?? null,
      invoiceNumberExtracted: record.extractedData.invoice_number ?? null,
      invoiceValueOriginal: record.extractedData.invoice_value ?? null,
      invoiceValueExtracted: record.extractedData.invoice_value ?? null,
      packageCountOriginal: record.extractedData.no_of_packages ?? null,
      packageCountExtracted: record.extractedData.no_of_packages ?? null,
      stampPresentOriginal: record.extractedData.stamp_present,
      stampPresentExtracted: record.extractedData.stamp_present,
      signaturePresentOriginal: record.extractedData.signature_present,
      signaturePresentExtracted: record.extractedData.signature_present,
      deliveryReviewStatus: reviewStatus,
      discrepancyReasons: [duplicateReason],
    },
  };
}

export async function processSelectedAwbFlow(input: SelectedFlowInput): Promise<EpodProcessResult> {
  const actor = input.actor ?? 'ops';
  const delayMs = input.delayMs ?? 3000;
  const recordMaps = buildRecordMaps();
  const selectedMap = buildShipmentMap(input.selectedShipments);
  const uploadedByAwb = new Map<string, { file: File; record: EpodExtractedPodRecord }>();
  const items: SelectedFlowProcessedItem[] = [];

  await sleep(delayMs);

  for (const file of input.files) {
    const reportRecord = resolveReportRecord(file, recordMaps);
    if (!reportRecord) {
      items.push(buildUnmappedItem(file, actor, 'No stored extracted POD data found for uploaded image'));
      continue;
    }

    const awb = normalizeAwb(reportRecord.extractedData.awb_number);
    if (!awb) {
      items.push(buildUnmappedItem(file, actor, 'AWB could not be extracted from stored data'));
      continue;
    }

    const shipment = selectedMap.get(awb);
    if (!shipment) {
      items.push(buildUnmappedItem(file, actor, `AWB ${awb} is not in the selected shipment scope`));
      continue;
    }

    const alreadyMapped = uploadedByAwb.has(awb);

    if (!alreadyMapped) {
      uploadedByAwb.set(awb, { file, record: reportRecord });
      const preset = resolveReviewPreset(reportRecord, items.length);
      items.push(buildMatchedItem(file, reportRecord, shipment, actor, preset, false));
      continue;
    }

    const firstMapped = uploadedByAwb.get(awb);
    if (firstMapped) {
      items.push(buildDuplicateItem(file, reportRecord, shipment, actor));
      continue;
    }
  }

  input.selectedShipments.forEach((shipment) => {
    const awb = normalizeAwb(shipment.awbNumber);
    if (!uploadedByAwb.has(awb)) {
      items.push(buildSkippedItem(shipment, actor));
    }
  });

  const summary = {
    totalAwbs: input.selectedShipments.length,
    totalUploadedImages: input.files.length,
    matchedCount: items.filter((item) => item.statusLabel === 'Matched').length,
    needsReviewCount: items.filter((item) => item.statusLabel === 'Needs Review').length,
    skippedCount: items.filter((item) => item.statusLabel === 'Skipped').length,
    unmappedCount: items.filter((item) => item.statusLabel === 'Unmapped').length,
  };

  return {
    summary,
    items: items as ProcessedItem[],
  };
}
