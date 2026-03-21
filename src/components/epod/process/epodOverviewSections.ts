import type { ProcessedFieldValue, ProcessedItem, ProcessedOcrPatch } from '@/lib/epodApi';

export interface EpodOverviewField {
  label: string;
  value: ProcessedFieldValue;
}

export interface EpodComparisonRow {
  key: 'awb' | 'consignee' | 'deliveryDate' | 'lineItems' | 'quantities' | 'remarks' | 'stamp';
  label: string;
  shipmentDetails: string;
  ocrDetails: string;
  matchStatus: 'Matched' | 'Not matched' | 'Not extracted';
}

export function renderFieldValue(value: ProcessedFieldValue | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

export function getSystemShipmentFields(item: ProcessedItem): EpodOverviewField[] {
  return [
    { label: 'AWB Number', value: item.systemData.awbNumber },
    { label: 'Shipment ID', value: item.systemData.shipmentId },
    { label: 'From', value: item.systemData.fromName },
    { label: 'From city', value: item.systemData.fromSubtext },
    { label: 'To', value: item.systemData.toName },
    { label: 'To city', value: item.systemData.toSubtext },
    { label: 'Transporter', value: item.systemData.transporter },
    { label: 'Delivered date', value: item.systemData.deliveredDate },
    { label: 'Packages', value: item.systemData.packages },
  ];
}

export function getExtractedDocumentFields(item: ProcessedItem): EpodOverviewField[] {
  return [
    { label: 'Carrier', value: item.ocrData.carrier ?? item.transporter },
    { label: 'File name', value: item.fileName },
    { label: 'Document type', value: item.ocrData.documentType },
    { label: 'Waybill / Docket / CN No.', value: item.ocrData.extractedAwb ?? item.awbNumber },
    { label: 'Booking branch', value: item.ocrData.bookingBranch },
    { label: 'Pickup date', value: item.ocrData.pickupDate },
    { label: 'Ship date', value: item.ocrData.shipDate },
    { label: 'Consignor', value: item.ocrData.consignor ?? item.ocrData.extractedFrom },
    { label: 'Consignor address', value: item.ocrData.consignorAddress },
    { label: 'Consignor phone', value: item.ocrData.consignorPhone },
    { label: 'Consignor PIN', value: item.ocrData.consignorPin },
    { label: 'Consignor GST', value: item.ocrData.consignorGst },
    { label: 'Consignee', value: item.ocrData.extractedConsignee ?? item.consigneeName },
    { label: 'Consignee address', value: item.ocrData.consigneeAddress },
    { label: 'Consignee phone', value: item.ocrData.consigneePhone },
    { label: 'Consignee PIN', value: item.ocrData.consigneePin },
    { label: 'Consignee GST', value: item.ocrData.consigneeGst },
    { label: 'From (origin)', value: item.ocrData.extractedFrom },
    { label: 'To (destination / GTY)', value: item.ocrData.extractedTo },
    { label: 'PIN code', value: item.ocrData.pinCode },
    { label: 'No. of packages', value: item.ocrData.packages },
    { label: 'Pkg/Act weight', value: item.ocrData.packageWeight },
    { label: 'Description / items', value: item.ocrData.description },
    { label: 'Total invoice value', value: item.ocrData.invoiceValue },
    { label: 'Total nos of invoices', value: item.ocrData.invoiceCount },
    { label: 'Invoice no(s)', value: item.ocrData.invoiceNumbers ?? item.invoiceNumberExtracted },
    { label: 'Freight amount', value: item.ocrData.freightAmount },
    { label: 'Freight mode', value: item.ocrData.freightMode },
    { label: 'Payment mode', value: item.ocrData.paymentMode },
    { label: 'Ewaybill no.', value: item.ocrData.ewaybillNumber },
    { label: 'Dimensions', value: item.ocrData.dimensions },
    { label: 'Vehicle number', value: item.ocrData.vehicleNumber },
    { label: 'POD copy type', value: item.ocrData.podCopyType },
  ];
}

export function getDrawerExtractedInfoFields(item: ProcessedItem): EpodOverviewField[] {
  const lineItems = item.lineItems.length > 0
    ? item.lineItems
        .map((line) => {
          const sku = line.sku ? `${line.sku} / ` : '';
          return `${sku}${line.description}`;
        })
        .join('\n')
    : item.ocrData.description;

  const sentVsReceived =
    item.lineItems.length > 0
      ? item.lineItems
          .map((line) => `Sent ${line.sentQty} / Received ${line.receivedQty}`)
          .join('\n')
      : item.sentQty !== null && item.sentQty !== undefined && item.receivedQty !== null && item.receivedQty !== undefined
        ? `Sent ${item.sentQty} / Received ${item.receivedQty}`
        : null;

  return [
    { label: 'AWB Number', value: item.ocrData.extractedAwb ?? item.awbNumber },
    { label: 'Consignee name', value: item.ocrData.extractedConsignee ?? item.consigneeName },
    { label: 'Delivery date', value: item.ocrData.extractedDeliveryDate },
    { label: 'Line items (SKU / description if available)', value: lineItems ?? null },
    { label: 'Sent vs Received quantities', value: sentVsReceived },
    { label: 'Remarks (damage, shortage notes)', value: item.ocrData.remarks ?? item.ocrData.conditionNotes },
    { label: 'Consignee stamp presence', value: item.ocrData.stampPresent ? 'Present' : 'Missing' },
  ];
}

function normalizeAwb(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s._-]/g, '').toUpperCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeDate(value: string | null | undefined): string {
  return (value ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function valueOrDash(value: string | null | undefined): string {
  return renderFieldValue(value);
}

function parseNumberList(value: string): number[] {
  return Array.from(value.matchAll(/\d+(?:\.\d+)?/g), (match) => Number(match[0]));
}

function buildShipmentLineItems(item: ProcessedItem): string {
  if (item.lineItems.length === 0) {
    return '—';
  }

  return item.lineItems
    .map((line) => {
      const sku = line.sku ? `${line.sku} / ` : '';
      return `${sku}${line.description}`;
    })
    .join('\n');
}

function buildSentReceivedShipment(item: ProcessedItem): string {
  if (item.lineItems.length === 0) {
    return item.sentQty !== null && item.sentQty !== undefined ? String(item.sentQty) : '—';
  }

  return item.lineItems.map((line) => String(line.sentQty)).join('\n');
}

function buildSentReceivedOcr(item: ProcessedItem): string {
  if (item.lineItems.length === 0) {
    return item.receivedQty !== null && item.receivedQty !== undefined ? String(item.receivedQty) : '—';
  }

  return item.lineItems.map((line) => String(line.receivedQty)).join('\n');
}

function getStampStatus(item: ProcessedItem): 'Matched' | 'Not matched' | 'Not extracted' {
  const stampSignal = item.ocrData.rawFields?.stamp_present;
  if (stampSignal === null || stampSignal === undefined) {
    return 'Not extracted';
  }

  return item.ocrData.stampPresent ? 'Matched' : 'Not matched';
}

export function getDrawerComparisonRows(
  item: ProcessedItem,
  draft?: Pick<
    ProcessedOcrPatch,
    'extractedAwb' | 'extractedConsignee' | 'extractedDeliveryDate' | 'description' | 'receivedQuantityNotes' | 'remarks' | 'stampPresent'
  >,
): EpodComparisonRow[] {
  const awbOcr = draft?.extractedAwb ?? item.ocrData.extractedAwb;
  const consigneeOcr = draft?.extractedConsignee ?? item.ocrData.extractedConsignee;
  const deliveryDateOcr = draft?.extractedDeliveryDate ?? item.ocrData.extractedDeliveryDate;
  const lineItemsOcr = draft?.description ?? item.ocrData.description;
  const remarksOcr = draft?.remarks ?? item.ocrData.remarks ?? item.ocrData.conditionNotes ?? null;
  const quantityNotes = draft?.receivedQuantityNotes ?? item.ocrData.receivedQuantityNotes ?? buildSentReceivedOcr(item);
  const shipmentQuantities = buildSentReceivedShipment(item);
  const quantityShipmentValues = parseNumberList(shipmentQuantities);
  const quantityOcrValues = parseNumberList(quantityNotes);
  const hasReceivedValues = quantityNotes.trim().length > 0 && quantityOcrValues.length > 0;
  const quantitiesMatched =
    hasReceivedValues &&
    quantityShipmentValues.length === quantityOcrValues.length &&
    quantityShipmentValues.every((value, index) => value === quantityOcrValues[index]);
  const shipmentLineItems = buildShipmentLineItems(item);
  const ocrLineDescription = valueOrDash(lineItemsOcr);
  const lineItemsMatched = lineItemsOcr
    ? item.lineItems.some((line) => {
        const description = normalizeText(line.description);
        const sku = normalizeText(line.sku);
        const ocr = normalizeText(lineItemsOcr);
        return description.includes(ocr) || ocr.includes(description) || (sku !== '' && (sku.includes(ocr) || ocr.includes(sku)));
      })
    : false;

  return [
    {
      key: 'awb',
      label: 'AWB Number',
      shipmentDetails: valueOrDash(item.systemData.awbNumber),
      ocrDetails: valueOrDash(awbOcr),
      matchStatus: !awbOcr
        ? 'Not extracted'
        : normalizeAwb(item.systemData.awbNumber) === normalizeAwb(awbOcr)
          ? 'Matched'
          : 'Not matched',
    },
    {
      key: 'consignee',
      label: 'Consignee name',
      shipmentDetails: valueOrDash(item.systemData.toName ?? item.consigneeName),
      ocrDetails: valueOrDash(consigneeOcr),
      matchStatus: !consigneeOcr
        ? 'Not extracted'
        : normalizeText(item.systemData.toName ?? item.consigneeName) === normalizeText(consigneeOcr)
          ? 'Matched'
          : 'Not matched',
    },
    {
      key: 'deliveryDate',
      label: 'Delivery date',
      shipmentDetails: valueOrDash(item.systemData.deliveredDate),
      ocrDetails: valueOrDash(deliveryDateOcr),
      matchStatus: !deliveryDateOcr
        ? 'Not extracted'
        : normalizeDate(item.systemData.deliveredDate) === normalizeDate(deliveryDateOcr)
          ? 'Matched'
          : 'Not matched',
    },
    {
      key: 'lineItems',
      label: 'Line items (SKU / description if available)',
      shipmentDetails: shipmentLineItems,
      ocrDetails: ocrLineDescription,
      matchStatus: !lineItemsOcr
        ? 'Not extracted'
        : lineItemsMatched
          ? 'Matched'
          : 'Not matched',
    },
    {
      key: 'quantities',
      label: 'Sent vs Received quantities',
      shipmentDetails: shipmentQuantities,
      ocrDetails: valueOrDash(quantityNotes),
      matchStatus: !hasReceivedValues
        ? 'Not extracted'
        : quantitiesMatched
          ? 'Matched'
          : 'Not matched',
    },
    {
      key: 'remarks',
      label: 'Remarks (damage, shortage notes)',
      shipmentDetails: '—',
      ocrDetails: valueOrDash(remarksOcr),
      matchStatus: !remarksOcr ? 'Not extracted' : 'Not matched',
    },
    {
      key: 'stamp',
      label: 'Consignee stamp presence',
      shipmentDetails: '—',
      ocrDetails: (draft?.stampPresent ?? item.ocrData.stampPresent) ? 'Present' : 'Missing',
      matchStatus:
        draft?.stampPresent === undefined && (item.ocrData.rawFields?.stamp_present === null || item.ocrData.rawFields?.stamp_present === undefined)
          ? 'Not extracted'
          : (draft?.stampPresent ?? item.ocrData.stampPresent)
            ? 'Matched'
            : 'Not matched',
    },
  ];
}

export function getPodProofFields(
  item: ProcessedItem,
  deliveryReviewStatus: 'clean' | 'unclean' | null,
): EpodOverviewField[] {
  return [
    { label: 'Receiver name', value: item.ocrData.receiverName },
    { label: 'Receiver name/stamp', value: item.ocrData.receiverStamp },
    { label: 'Delivery date (signed)', value: item.ocrData.extractedDeliveryDate },
    { label: 'Receiver phone', value: item.ocrData.receiverPhone },
    { label: 'Remarks / special notes', value: item.ocrData.remarks },
    { label: 'Condition notes', value: item.ocrData.conditionNotes },
    { label: 'Stamp present', value: item.ocrData.stampPresent ? 'Yes' : 'No' },
    { label: 'Signature present', value: item.ocrData.signaturePresent ? 'Yes' : 'No' },
    { label: 'Delivery review status', value: deliveryReviewStatus === null ? null : deliveryReviewStatus === 'clean' ? 'Clean delivery' : 'Unclean delivery' },
  ];
}
