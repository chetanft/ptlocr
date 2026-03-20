import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  CheckboxInput,
  Input,
  InputField,
  InputLabel,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Textarea,
  TextareaField,
  TextareaLabel,
  Typography,
} from 'ft-design-system';
import type { ProcessedItem } from '@/lib/epodApi';
import { rem14 } from '@/lib/rem';
import { createEpodOcrDraft, type EpodOcrDraft } from './epodOcrDraft';

type Role = 'Transporter' | 'Ops' | 'Reviewer';

export interface EpodImagePreview {
  fileName: string;
  previewUrl: string;
  previewKind: 'image' | 'pdf' | 'other';
}

interface EpodImagePreviewModalProps {
  open: boolean;
  item: ProcessedItem | null;
  preview: EpodImagePreview | null;
  role: Role;
  draft: EpodOcrDraft | null;
  onDraftChange: (draft: EpodOcrDraft) => void;
  onSaveOcrEdits: (patch: EpodOcrDraft) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function renderValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

export function EpodImagePreviewModal({
  open,
  item,
  preview,
  role,
  draft,
  onDraftChange,
  onSaveOcrEdits,
  onOpenChange,
  isSaving = false,
  errorMessage,
}: EpodImagePreviewModalProps) {
  const readOnly = role === 'Transporter';
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) {
      setZoom(1);
    }
  }, [open]);

  useEffect(() => {
    setZoom(1);
  }, [preview?.previewUrl]);

  const originalDraft = useMemo(() => (item ? createEpodOcrDraft(item) : null), [item]);
  const hasDraftChanges = useMemo(() => {
    if (!draft || !originalDraft) {
      return false;
    }
    return JSON.stringify(draft) !== JSON.stringify(originalDraft);
  }, [draft, originalDraft]);

  const deliveryReviewStatus = draft?.deliveryReviewStatus ?? null;
  const isClean = deliveryReviewStatus === 'clean';
  const isUnclean = deliveryReviewStatus === 'unclean';

  const updateDraft = (next: Partial<EpodOcrDraft>) => {
    if (!draft) {
      return;
    }
    onDraftChange({
      ...draft,
      ...next,
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="w-[min(1180px,96vw)] max-w-none">
        <ModalHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex flex-col gap-2">
              <ModalTitle className="max-w-full truncate text-[2rem] leading-tight">
                {preview?.fileName ?? item?.fileName ?? 'Image review'}
              </ModalTitle>
              {item ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                  <Badge variant="secondary">{item.confidenceLabel} confidence</Badge>
                  {deliveryReviewStatus ? (
                    <Badge variant={deliveryReviewStatus === 'clean' ? 'success' : 'warning'}>
                      {deliveryReviewStatus === 'clean' ? 'Clean delivery' : 'Unclean delivery'}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="zoom-out"
                iconPosition="only"
                aria-label="Zoom out"
                onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
                disabled={!preview || zoom <= MIN_ZOOM}
              />
              <div
                className="flex items-center justify-center rounded-md border border-border-primary bg-bg-secondary"
                style={{ minWidth: rem14(72), minHeight: rem14(36) }}
              >
                <Typography variant="body-secondary-medium" color="primary">
                  {Math.round(zoom * 100)}%
                </Typography>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="zoom-in"
                iconPosition="only"
                aria-label="Zoom in"
                onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
                disabled={!preview || zoom >= MAX_ZOOM}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(1)}
                disabled={!preview || zoom === 1}
              >
                Reset
              </Button>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,24rem)]">
            <div className="flex min-h-[28rem] min-w-0 flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <Typography variant="body-primary-medium" color="primary" className="text-[1.125rem] leading-7">
                  Uploaded POD image
                </Typography>
                {item ? (
                  <Typography variant="body-secondary-regular" color="secondary">
                    AWB {renderValue(item.awbNumber)}
                  </Typography>
                ) : null}
              </div>
              {preview?.previewUrl ? (
                <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border-primary bg-[var(--bg-secondary)] p-6">
                  <div className="flex min-h-full min-w-full items-center justify-center">
                    <img
                      src={preview.previewUrl}
                      alt={preview.fileName}
                      className="h-auto w-auto max-h-[42rem] max-w-full rounded-xl object-contain shadow-sm"
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: 'transform 120ms ease-out',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-border-primary bg-[var(--bg-secondary)] px-6 py-10">
                  <Typography variant="body-primary-regular" color="secondary">
                    No image preview available for this file.
                  </Typography>
                </div>
              )}
            </div>

            <div className="flex min-h-[28rem] min-w-0 flex-col gap-4">
              {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

              {item ? (
                <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
                  <Typography variant="body-primary-medium" color="primary" className="text-[1.125rem] leading-7">
                    Shipment data in system
                  </Typography>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(
                      [
                        ['AWB Number', item.systemData.awbNumber],
                        ['Shipment ID', item.systemData.shipmentId],
                        ['From', item.systemData.fromName],
                        ['From city', item.systemData.fromSubtext],
                        ['To', item.systemData.toName],
                        ['To city', item.systemData.toSubtext],
                        ['Transporter', item.systemData.transporter],
                        ['Delivered date', item.systemData.deliveredDate],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1">
                        <Typography variant="body-secondary-medium" color="secondary">
                          {label}
                        </Typography>
                        <Typography variant="body-secondary-regular" color="primary">
                          {renderValue(value)}
                        </Typography>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-border-primary p-4">
                <div className="flex items-center justify-between gap-3">
                  <Typography variant="body-primary-medium" color="primary" className="text-[1.125rem] leading-7">
                    OCR extracted POD data
                  </Typography>
                  {readOnly ? (
                    <Badge variant="secondary">Read only</Badge>
                  ) : null}
                </div>
                {draft ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <Input>
                      <InputLabel>Extracted AWB</InputLabel>
                      <InputField
                        value={draft.extractedAwb ?? ''}
                        onChange={(event) => updateDraft({ extractedAwb: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Input>
                    <Input>
                      <InputLabel>Extracted Consignee</InputLabel>
                      <InputField
                        value={draft.extractedConsignee ?? ''}
                        onChange={(event) => updateDraft({ extractedConsignee: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Input>
                    <Input>
                      <InputLabel>Extracted Delivery Date</InputLabel>
                      <InputField
                        value={draft.extractedDeliveryDate ?? ''}
                        onChange={(event) => updateDraft({ extractedDeliveryDate: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Input>
                    <Input>
                      <InputLabel>Extracted From</InputLabel>
                      <InputField
                        value={draft.extractedFrom ?? ''}
                        onChange={(event) => updateDraft({ extractedFrom: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Input>
                    <Input>
                      <InputLabel>Extracted To</InputLabel>
                      <InputField
                        value={draft.extractedTo ?? ''}
                        onChange={(event) => updateDraft({ extractedTo: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Input>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2">
                        <CheckboxInput
                          checked={draft.stampPresent ?? false}
                          onChange={(event) => updateDraft({ stampPresent: event.target.checked })}
                          disabled={readOnly}
                        />
                        <Typography variant="body-secondary-regular" color="primary">
                          Stamp present
                        </Typography>
                      </label>
                      <label className="flex items-center gap-2">
                        <CheckboxInput
                          checked={draft.signaturePresent ?? false}
                          onChange={(event) => updateDraft({ signaturePresent: event.target.checked })}
                          disabled={readOnly}
                        />
                        <Typography variant="body-secondary-regular" color="primary">
                          Signature present
                        </Typography>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Typography variant="body-primary-medium" color="primary">
                        Delivery review outcome
                      </Typography>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={isClean ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => updateDraft({ deliveryReviewStatus: 'clean' })}
                          disabled={readOnly}
                        >
                          Clean delivery
                        </Button>
                        <Button
                          variant={isUnclean ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => updateDraft({ deliveryReviewStatus: 'unclean' })}
                          disabled={readOnly}
                        >
                          Unclean delivery
                        </Button>
                        {deliveryReviewStatus ? (
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => updateDraft({ deliveryReviewStatus: null })}
                            disabled={readOnly}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <Textarea>
                      <TextareaLabel>Remarks</TextareaLabel>
                      <TextareaField
                        value={draft.remarks ?? ''}
                        onChange={(event) => updateDraft({ remarks: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Textarea>
                    <Textarea>
                      <TextareaLabel>Condition Notes</TextareaLabel>
                      <TextareaField
                        value={draft.conditionNotes ?? ''}
                        onChange={(event) => updateDraft({ conditionNotes: event.target.value || null })}
                        disabled={readOnly}
                      />
                    </Textarea>
                  </div>
                ) : (
                  <div className="flex min-h-[16rem] items-center justify-center">
                    <Typography variant="body-primary-regular" color="secondary">
                      OCR data is unavailable for this file.
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Typography variant="body-secondary-regular" color="secondary">
              Review the image and update extracted values before returning to reconciliation.
            </Typography>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {!readOnly ? (
                <Button
                  variant="primary"
                  onClick={() => void (draft ? onSaveOcrEdits(draft) : undefined)}
                  disabled={!draft || !hasDraftChanges}
                  loading={isSaving}
                >
                  Save OCR changes
                </Button>
              ) : null}
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
