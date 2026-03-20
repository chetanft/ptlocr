import type {
  EpodBatchItem,
  EpodProcessedDisplayRow,
  EpodSelectedShipment,
} from './types';

export function formatIssueSummary(item: EpodBatchItem): string {
  if (item.blockingReason) return item.blockingReason;
  if (item.warningReason) return item.warningReason;
  if (item.exceptions.length > 0) {
    return item.exceptions
      .map((exception) => exception.description || exception.type)
      .join(' | ');
  }
  return 'No issues detected';
}

export function formatConfidence(confidence?: number | null): string {
  if (typeof confidence !== 'number') return '—';
  return `${Math.round(confidence * 100)}%`;
}

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== '—' ? trimmed : null;
}

function mergeShipmentData(item: EpodBatchItem, shipments: EpodSelectedShipment[]) {
  const shipmentByAwb = new Map(shipments.map((shipment) => [shipment.awbNumber, shipment]));
  const matchedShipment =
    shipmentByAwb.get(item.awbNumber || '') ||
    shipmentByAwb.get(item.extractedAwb || '');

  return {
    shipmentId: normalizeText(matchedShipment?.shipmentId || item.shipmentId),
    fromName: normalizeText(matchedShipment?.origin || item.origin),
    fromSubtext: normalizeText(matchedShipment?.originCity || item.originCity),
    toName: normalizeText(matchedShipment?.consigneeName || item.consigneeName),
    toSubtext: normalizeText(matchedShipment?.destination || item.destination),
    transporter: normalizeText(matchedShipment?.transporter || item.transporter),
  };
}

function getCompletenessScore(fields: Array<string | null>): number {
  if (fields.length === 0) return 0;
  const present = fields.filter(Boolean).length;
  return present / fields.length;
}

export function buildProcessedDisplayRows(
  items: EpodBatchItem[],
  shipments: EpodSelectedShipment[],
): EpodProcessedDisplayRow[] {
  return items.map((item) => {
    const shipmentData = mergeShipmentData(item, shipments);
    const awbNumber = normalizeText(item.awbNumber || item.extractedAwb) || '—';
    const criticalFields = [
      shipmentData.shipmentId,
      shipmentData.fromName,
      shipmentData.fromSubtext,
      shipmentData.toName,
      shipmentData.toSubtext,
      shipmentData.transporter,
    ];
    const completeness = getCompletenessScore(criticalFields);
    const fallbackConfidence =
      typeof item.ocrConfidence === 'number'
        ? Math.max(item.ocrConfidence, completeness)
        : completeness;

    const missingLabels: string[] = [];
    if (!shipmentData.shipmentId) missingLabels.push('Shipment ID');
    if (!shipmentData.fromName || !shipmentData.fromSubtext) missingLabels.push('From');
    if (!shipmentData.toName || !shipmentData.toSubtext) missingLabels.push('To');
    if (!shipmentData.transporter) missingLabels.push('Transporter');

    const issueSummary = formatIssueSummary(item);
    let statusLabel: EpodProcessedDisplayRow['statusLabel'] = 'Matched';
    let statusVariant: EpodProcessedDisplayRow['statusVariant'] = 'success';
    let reason = issueSummary === 'No issues detected' ? '-' : issueSummary;

    if (item.reviewBucket === 'BLOCKED') {
      statusLabel = 'Skipped';
      statusVariant = 'danger';
    } else if (item.reviewBucket === 'UNMAPPED_IMAGES') {
      statusLabel = 'Unmapped';
      statusVariant = 'secondary';
    } else if (item.reviewBucket === 'NEEDS_REVIEW') {
      statusLabel = 'Needs Review';
      statusVariant = 'warning';
    } else if (missingLabels.length > 0) {
      statusLabel = 'Needs Review';
      statusVariant = 'warning';
      reason = `Incomplete extracted data: missing ${missingLabels.join(', ')}`;
    }

    return {
      id: item.id,
      awbNumber,
      shipmentId: shipmentData.shipmentId,
      fromName: shipmentData.fromName,
      fromSubtext: shipmentData.fromSubtext,
      toName: shipmentData.toName,
      toSubtext: shipmentData.toSubtext,
      transporter: shipmentData.transporter,
      fileName: item.fileName,
      statusLabel,
      statusVariant,
      reason,
      confidence: fallbackConfidence,
      confidenceLabel: formatConfidence(fallbackConfidence),
    };
  });
}
