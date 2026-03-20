import crypto from 'crypto';

type StatusLabel = 'Matched' | 'Needs Review' | 'Skipped' | 'Unmapped';
type StatusVariant = 'success' | 'warning' | 'danger' | 'secondary';

export interface EpodWorkflowItem {
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
  statusLabel: StatusLabel;
  statusVariant: StatusVariant;
  reason: string;
  confidence: number;
  confidenceLabel: string;
  stampPresent: boolean;
  signaturePresent: boolean;
  deliveryReviewStatus?: 'clean' | 'unclean' | null;
  systemData: any;
  ocrData: any;
  lineItems: any[];
  exceptions: any[];
  auditTrail: any[];
  ocrFields: Record<string, unknown>;
}

export interface EpodWorkflowState {
  batchId: string;
  summary: {
    totalAwbs: number;
    totalUploadedImages: number;
    matchedCount: number;
    needsReviewCount: number;
    skippedCount: number;
    unmappedCount: number;
  };
  items: EpodWorkflowItem[];
}

const workflowStore = new Map<string, EpodWorkflowState>();

function recomputeSummary(items: EpodWorkflowItem[]) {
  return {
    totalAwbs: new Set(items.filter((item) => !!item.awbNumber).map((item) => item.awbNumber)).size,
    totalUploadedImages: items.length,
    matchedCount: items.filter((item) => item.statusLabel === 'Matched').length,
    needsReviewCount: items.filter((item) => item.statusLabel === 'Needs Review').length,
    skippedCount: items.filter((item) => item.statusLabel === 'Skipped').length,
    unmappedCount: items.filter((item) => item.statusLabel === 'Unmapped').length,
  };
}

function appendAudit(item: EpodWorkflowItem, actor: string, description: string): EpodWorkflowItem {
  return {
    ...item,
    auditTrail: [
      ...item.auditTrail,
      {
        id: `${item.id}-${item.auditTrail.length + 1}`,
        timestamp: new Date().toISOString(),
        actor,
        description,
      },
    ],
  };
}

export const epodWorkflowStore = {
  create(result: { summary: EpodWorkflowState['summary']; items: EpodWorkflowItem[] }) {
    const batchId = crypto.randomUUID();
    const state: EpodWorkflowState = {
      batchId,
      summary: recomputeSummary(result.items),
      items: result.items,
    };
    workflowStore.set(batchId, state);
    return state;
  },

  applyAction(input: {
    batchId: string;
    itemId: string;
    actor: string;
    actionType: 'document' | 'line-review' | 'line-override' | 'exception-resolve' | 'ocr-update';
    documentAction?: 'accept' | 'reject' | 'review' | 'sendToReviewer' | 'approve';
    lineId?: string;
    reviewAction?: 'ACCEPTED' | 'REJECTED';
    exceptionId?: string;
    ocrPatch?: {
      extractedAwb?: string | null;
      extractedConsignee?: string | null;
      extractedDeliveryDate?: string | null;
      extractedFrom?: string | null;
      extractedTo?: string | null;
      stampPresent?: boolean;
      signaturePresent?: boolean;
      remarks?: string | null;
      conditionNotes?: string | null;
      deliveryReviewStatus?: 'clean' | 'unclean' | null;
    };
  }) {
    const state = workflowStore.get(input.batchId);
    if (!state) {
      throw new Error('Workflow batch not found');
    }

    const items = state.items.map((item) => {
      if (item.id !== input.itemId) {
        return item;
      }

      if (input.actionType === 'document' && input.documentAction) {
        switch (input.documentAction) {
          case 'accept':
            return appendAudit({ ...item, statusLabel: 'Matched', statusVariant: 'success', reason: 'Accepted after processing review', exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })) }, input.actor, 'Document accepted during processing review');
          case 'reject':
            return appendAudit({ ...item, statusLabel: 'Skipped', statusVariant: 'danger', reason: 'Rejected during processing review' }, input.actor, 'Document rejected during processing review');
          case 'review':
            return appendAudit({ ...item, statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Marked for manual review' }, input.actor, 'Document marked for manual review');
          case 'sendToReviewer':
            return appendAudit({ ...item, statusLabel: 'Needs Review', statusVariant: 'warning', reason: 'Sent to reviewer for final review' }, input.actor, 'Document sent to reviewer');
          case 'approve':
            return appendAudit({ ...item, statusLabel: 'Matched', statusVariant: 'success', reason: 'Approved by reviewer', exceptions: item.exceptions.map((exception) => ({ ...exception, resolved: true })) }, input.actor, 'Document approved by reviewer');
        }
      }

      if (input.actionType === 'line-review' && input.lineId && input.reviewAction) {
        return appendAudit(
          {
            ...item,
            lineItems: item.lineItems.map((line) => line.id === input.lineId ? { ...line, reviewAction: input.reviewAction } : line),
            statusLabel: input.reviewAction === 'REJECTED' ? 'Needs Review' : item.statusLabel,
            statusVariant: input.reviewAction === 'REJECTED' ? 'warning' : item.statusVariant,
            reason: input.reviewAction === 'REJECTED' ? 'Line item rejected during review' : item.reason,
          },
          input.actor,
          `Line item ${input.lineId} marked ${input.reviewAction}`,
        );
      }

      if (input.actionType === 'line-override' && input.lineId) {
        return appendAudit(
          {
            ...item,
            lineItems: item.lineItems.map((line) => line.id === input.lineId ? { ...line, receivedQty: line.sentQty, damagedQty: 0, difference: 0, reconStatus: 'MATCH', reviewAction: 'OVERRIDDEN', note: 'Override aligned received quantity with shipment data' } : line),
            statusLabel: 'Needs Review',
            statusVariant: 'warning',
            reason: 'Line item overridden during review',
          },
          input.actor,
          `Line item ${input.lineId} overridden to match shipment data`,
        );
      }

      if (input.actionType === 'exception-resolve' && input.exceptionId) {
        const exceptions = item.exceptions.map((exception) => exception.id === input.exceptionId ? { ...exception, resolved: true } : exception);
        const unresolvedCount = exceptions.filter((exception) => !exception.resolved).length;
        return appendAudit(
          {
            ...item,
            exceptions,
            statusLabel: unresolvedCount === 0 ? 'Matched' : 'Needs Review',
            statusVariant: unresolvedCount === 0 ? 'success' : 'warning',
            reason: unresolvedCount === 0 ? 'All exceptions resolved' : 'Review in progress',
          },
          input.actor,
          `Exception ${input.exceptionId} marked resolved`,
        );
      }

      if (input.actionType === 'ocr-update' && input.ocrPatch) {
        const nextOcrData = { ...item.ocrData, ...input.ocrPatch };
        return appendAudit(
          {
            ...item,
            awbNumber: nextOcrData.extractedAwb ?? item.awbNumber,
            ocrData: nextOcrData,
            stampPresent: nextOcrData.stampPresent,
            signaturePresent: nextOcrData.signaturePresent,
            deliveryReviewStatus: nextOcrData.deliveryReviewStatus ?? (item as any).deliveryReviewStatus ?? null,
            ocrFields: {
              ...item.ocrFields,
              awb_number: nextOcrData.extractedAwb,
              consignee_name: nextOcrData.extractedConsignee,
              delivery_date: nextOcrData.extractedDeliveryDate,
              consignor_name: nextOcrData.extractedFrom,
              to_city: nextOcrData.extractedTo,
              stamp_present: nextOcrData.stampPresent,
              signature_present: nextOcrData.signaturePresent,
              remarks: nextOcrData.remarks,
              condition_notes: nextOcrData.conditionNotes,
            },
            statusLabel: 'Needs Review',
            statusVariant: 'warning',
            reason: nextOcrData.deliveryReviewStatus
              ? `OCR fields edited manually and marked ${nextOcrData.deliveryReviewStatus === 'clean' ? 'clean delivery' : 'unclean delivery'}`
              : 'OCR fields edited manually',
          },
          input.actor,
          'OCR extracted fields updated manually',
        );
      }

      return item;
    });

    const nextState: EpodWorkflowState = {
      batchId: state.batchId,
      items,
      summary: recomputeSummary(items),
    };
    workflowStore.set(state.batchId, nextState);
    return nextState;
  },
};
