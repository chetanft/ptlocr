import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getSystemShipmentFields,
  renderFieldValue,
} from './epodOverviewSections';

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

function ReadOnlyFieldGrid({
  fields,
}: {
  fields: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1">
          <Typography variant="body-secondary-medium" color="secondary">
            {label}
          </Typography>
          <Typography variant="body-secondary-regular" color="primary">
            {renderFieldValue(value)}
          </Typography>
        </div>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  trailing,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border-primary overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-bg-secondary p-4 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <Typography variant="body-primary-medium" color="primary" className="text-[1.125rem] leading-7">
            {title}
          </Typography>
          {trailing}
        </div>
        <span
          className="text-text-secondary transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: rem14(18) }}
        >
          &#9660;
        </span>
      </button>
      {isOpen ? <div className="p-4">{children}</div> : null}
    </div>
  );
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
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) resetView();
  }, [open, resetView]);

  useEffect(() => {
    resetView();
  }, [preview?.previewUrl, resetView]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (zoom <= 1) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    },
    [zoom, pan],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

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
      <ModalContent className="!w-[min(1200px,96vw)] max-w-none">
        <ModalHeader>
          <div className="flex w-full items-start justify-between gap-4">
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
                aria-label="Zoom out"
                onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
                disabled={!preview || zoom <= MIN_ZOOM}
              >
                &minus;
              </Button>
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
                aria-label="Zoom in"
                onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
                disabled={!preview || zoom >= MAX_ZOOM}
              >
                +
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Rotate clockwise"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={!preview}
              >
                &#x21BB;
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetView}
                disabled={!preview || (zoom === 1 && pan.x === 0 && pan.y === 0 && rotation === 0)}
              >
                Reset
              </Button>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
            <div className="flex min-h-[28rem] w-full min-w-0 flex-col gap-4 xl:w-auto xl:flex-[1.2]">
              <div className="flex items-center justify-between gap-3">
                <Typography variant="body-primary-medium" color="primary" className="text-[1.125rem] leading-7">
                  Uploaded POD image
                </Typography>
                {item ? (
                  <Typography variant="body-secondary-regular" color="secondary">
                    AWB {renderFieldValue(item.awbNumber)}
                  </Typography>
                ) : null}
              </div>
              {preview?.previewUrl ? (
                <div
                  className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border-primary bg-[var(--bg-secondary)] p-6"
                  style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <div className="flex min-h-full min-w-full items-center justify-center select-none">
                    <img
                      src={preview.previewUrl}
                      alt={preview.fileName}
                      draggable={false}
                      className="h-auto w-auto max-h-[42rem] max-w-full rounded-xl object-contain shadow-sm"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transformOrigin: 'center center',
                        transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
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

            <div className="flex min-h-[28rem] w-full min-w-0 flex-col gap-4 xl:w-auto xl:min-w-[26rem] xl:max-w-[34rem] xl:shrink-0">
              {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

              {item ? (
                <CollapsibleSection title="Shipment data in system">
                  <ReadOnlyFieldGrid fields={getSystemShipmentFields(item)} />
                </CollapsibleSection>
              ) : null}

              <CollapsibleSection
                title="Review-editable OCR fields"
                trailing={readOnly ? <Badge variant="secondary">Read only</Badge> : undefined}
              >
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
              </CollapsibleSection>
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
                  variant="secondary"
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
