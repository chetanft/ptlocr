"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEpodBatch = processEpodBatch;
const openaiOcr_js_1 = require("./openaiOcr.js");
const shipmentMaster_js_1 = require("./shipmentMaster.js");
function classifyItem(extracted, confidence, matchedShipment, selectedAwbs, _fileName) {
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
    ].filter(Boolean);
    // AWB not in selected scope (if selection mode)
    if (selectedAwbs && selectedAwbs.length > 0) {
        const normalizedSelected = selectedAwbs.map(shipmentMaster_js_1.normalizeAwb);
        if (!normalizedSelected.includes((0, shipmentMaster_js_1.normalizeAwb)(extractedAwb))) {
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
        const missing = [];
        if (!extracted.stamp_present)
            missing.push('stamp');
        if (!extracted.signature_present)
            missing.push('signature');
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
function mapBucket(statusLabel) {
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
function getConfidenceLabel(confidence) {
    if (confidence >= 0.8)
        return 'High';
    if (confidence >= 0.5)
        return 'Medium';
    return 'Low';
}
function countMatchedAwbs(items) {
    return new Set(items
        .filter((item) => item.statusLabel !== 'Unmapped' && Boolean(item.awbNumber))
        .map((item) => (0, shipmentMaster_js_1.normalizeAwb)(item.awbNumber))).size;
}
function buildLineItems(matchedShipment, extracted, fileName) {
    const sentQty = matchedShipment?.packageCount ?? extracted.no_of_packages ?? 0;
    const receivedQty = extracted.no_of_packages ?? sentQty;
    const remarks = `${extracted.remarks || ''} ${extracted.condition_notes || ''}`.toLowerCase();
    const damagedQty = /damage|broken|torn|wet|crushed/.test(remarks) ? 1 : 0;
    const difference = receivedQty - sentQty;
    let reconStatus = 'MATCH';
    if (damagedQty > 0) {
        reconStatus = 'DAMAGED';
    }
    else if (difference < 0) {
        reconStatus = 'SHORT';
    }
    else if (difference > 0) {
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
function buildExceptions(classification, extracted, lineItems) {
    const exceptions = [];
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
function buildAuditTrail(fileName, actor, classification) {
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
async function processEpodBatch(files, selectedAwbs, apiKey, provider = 'openai') {
    const items = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing ${i + 1}/${files.length}: ${file.name}`);
        // 1. Run OCR
        const { result: ocrFields, confidence } = await (0, openaiOcr_js_1.extractFieldsFromFile)(file.buffer, file.name, apiKey, provider);
        // 2. Match shipment
        let matchedShipment = null;
        if (ocrFields.awb_number) {
            matchedShipment = (0, shipmentMaster_js_1.findShipmentByAwb)(ocrFields.awb_number);
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
