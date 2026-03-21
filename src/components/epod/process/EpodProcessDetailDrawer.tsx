import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  InputField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  TextareaField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Typography,
  RadioGroup,
  RadioItem,
  RadioItemInput,
  RadioItemLabel,
} from 'ft-design-system';
import type { ProcessedItem, ProcessedLineItem, ProcessedOcrPatch } from '@/lib/epodApi';
import { ExceptionBadge } from '@/components/pod/ExceptionBadge';
import { rem14 } from '@/lib/rem';
import { createEpodOcrDraft } from './epodOcrDraft';
import {
  getDrawerComparisonRows,
  getSystemShipmentFields,
  renderFieldValue,
} from './epodOverviewSections';

/** Row hover: bottom border matches secondary surface (TableCell defaults to --border-primary). */
const TABLE_CELL_ROW_HOVER_BORDER = 'group-hover/table-row:border-b-[var(--border-secondary)]';

type Role = 'Transporter' | 'Ops' | 'Reviewer';

interface EpodProcessDetailDrawerProps {
  item: ProcessedItem | null;
  open: boolean;
  role: Role;
  onOpenChange: (open: boolean) => void;
  onDocumentAction: (action: 'reject' | 'sendToReviewer' | 'approve') => void;
  onLineReview: (lineId: string, action: 'ACCEPTED' | 'REJECTED') => void;
  onLineOverride: (lineId: string) => void;
  onResolveException: (exceptionId: string) => void;
  onSaveOcrEdits: (ocrPatch: ProcessedOcrPatch) => Promise<void> | void;
  previewUrl?: string | null;
  canPreview?: boolean;
  onPreview?: () => void;
}

function ReconciliationTab({
  item,
  readOnly,
  onLineReview,
  onLineOverride,
}: {
  item: ProcessedItem;
  readOnly: boolean;
  onLineReview: (lineId: string, action: 'ACCEPTED' | 'REJECTED') => void;
  onLineOverride: (lineId: string) => void;
}) {
  const headerCell = (label: string) => (
    <Typography variant="body-secondary-medium" color="primary">
      {label}
    </Typography>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('SKU / Description')}</TableHead>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Sent Qty')}</TableHead>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Received Qty')}</TableHead>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Damaged Qty')}</TableHead>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Difference')}</TableHead>
          <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Recon Status')}</TableHead>
          {!readOnly ? <TableHead style={{ backgroundColor: 'var(--bg-secondary)' }}>{headerCell('Actions')}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {item.lineItems.map((line) => (
          <TableRow key={line.id}>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>
              <div className="flex flex-col gap-1">
                <Typography variant="body-primary-medium" color="primary">
                  {line.description}
                </Typography>
                <Typography variant="body-secondary-regular" color="secondary">
                  {line.sku ?? '—'}
                </Typography>
              </div>
            </TableCell>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>{line.sentQty}</TableCell>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>{line.receivedQty}</TableCell>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>{line.damagedQty}</TableCell>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>{line.difference}</TableCell>
            <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>
              <Badge variant={RECON_STATUS_META[line.reconStatus].variant}>
                {RECON_STATUS_META[line.reconStatus].label}
              </Badge>
            </TableCell>
            {!readOnly ? (
              <TableCell className={TABLE_CELL_ROW_HOVER_BORDER}>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onLineReview(line.id, 'ACCEPTED')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onLineOverride(line.id)}>
                    Override
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onLineReview(line.id, 'REJECTED')}>
                    Reject
                  </Button>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OverviewCard({
  title,
  fields,
}: {
  title: string;
  fields: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <div className="flex flex-col py-1" style={{ gap: rem14(12) }}>
      <Typography variant="body-primary-medium" color="primary" className="text-[1rem] font-semibold leading-6">
        {title}
      </Typography>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="font-sans text-sm-rem font-medium leading-[1.4] text-[var(--tertiary)]">
              {label}
            </span>
            <span className="font-sans text-sm-rem font-normal leading-[1.4] whitespace-pre-wrap text-[var(--primary)]">
              {renderFieldValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchStatusBadge({ status }: { status: 'Matched' | 'Not matched' | 'Not extracted' }) {
  const variant = status === 'Matched' ? 'success' : status === 'Not matched' ? 'warning' : 'secondary';
  return (
    <div className="inline-flex w-fit max-w-full whitespace-nowrap">
      <Badge variant={variant}>
        <span className="whitespace-nowrap">{status}</span>
      </Badge>
    </div>
  );
}

const RECON_STATUS_META = {
  MATCH: { label: 'Match', variant: 'success' as const },
  SHORT: { label: 'Short', variant: 'warning' as const },
  EXCESS: { label: 'Excess', variant: 'warning' as const },
  DAMAGED: { label: 'Damaged', variant: 'danger' as const },
} as const;

export function EpodProcessDetailDrawer({
  item,
  open,
  role,
  onOpenChange,
  onDocumentAction,
  onLineReview,
  onLineOverride,
  onResolveException,
  onSaveOcrEdits,
  previewUrl,
  canPreview,
  onPreview,
}: EpodProcessDetailDrawerProps) {
  const readOnly = role === 'Transporter';
  const [draft, setDraft] = useState(() => (item ? createEpodOcrDraft(item) : null));
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  useEffect(() => {
    setDraft(item ? createEpodOcrDraft(item) : null);
  }, [item]);
  const originalDraft = useMemo(() => (item ? createEpodOcrDraft(item) : null), [item]);
  const hasDraftChanges = useMemo(() => {
    if (!draft || !originalDraft) {
      return false;
    }
    return JSON.stringify(draft) !== JSON.stringify(originalDraft);
  }, [draft, originalDraft]);
  const deliveryReviewStatus = draft?.deliveryReviewStatus ?? null;
  const showPreview = Boolean(previewUrl && canPreview !== false);

  if (!item || !draft) {
    return null;
  }

  const comparisonRows = getDrawerComparisonRows(item, draft);
  const reconciliationBadgeStatuses = Array.from(new Set(item.lineItems.map((line) => line.reconStatus)));

  const updateDraft = (next: Partial<typeof draft>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
  };

  const handleSaveDrawerDraft = async () => {
    if (!hasDraftChanges) {
      return;
    }

    try {
      setIsSavingDraft(true);
      await onSaveOcrEdits(draft);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const footerActions =
    role === 'Reviewer'
      ? [
          <Button key="reject" variant="secondary" onClick={() => onDocumentAction('reject')}>
            Reject
          </Button>,
          <Button key="approve" variant="primary" onClick={() => onDocumentAction('approve')}>
            Approve
          </Button>,
        ]
      : role === 'Ops'
        ? [
            <Button key="send" variant="primary" onClick={() => onDocumentAction('sendToReviewer')}>
              Send to reviewer
            </Button>,
          ]
      : [];
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent placement="right" width={760}>
        <DrawerHeader>
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <DrawerTitle className="text-[1rem] font-semibold leading-6">{item.fileName}</DrawerTitle>
                <div className="flex items-center gap-2">
                  <div className="inline-flex w-fit">
                    <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                  </div>
                  <div className="inline-flex w-fit">
                    <Badge variant="secondary">{item.confidenceLabel} confidence</Badge>
                  </div>
                  <div className="inline-flex w-fit">
                    <Badge variant={draft.stampPresent ? 'success' : 'danger'}>
                      {draft.stampPresent ? 'Stamp present' : 'Stamp missing'}
                    </Badge>
                  </div>
                  <div className="inline-flex w-fit">
                    <Badge variant={draft.signaturePresent ? 'success' : 'danger'}>
                      {draft.signaturePresent ? 'Signature present' : 'Signature missing'}
                    </Badge>
                  </div>
                  {deliveryReviewStatus ? (
                    <div className="inline-flex w-fit">
                      <Badge variant={deliveryReviewStatus === 'clean' ? 'success' : 'warning'}>
                        {deliveryReviewStatus === 'clean' ? 'Clean delivery' : 'Unclean delivery'}
                      </Badge>
                  </div>
                ) : null}
              </div>
            </div>
            <DrawerClose />
          </div>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex flex-col" style={{ gap: rem14(16) }}>
            {item.reason && item.reason !== 'All validations passed' ? (
              <Alert variant={item.statusLabel === 'Matched' ? 'success' : item.statusLabel === 'Needs Review' ? 'warning' : 'danger'}>
                {item.reason}
              </Alert>
            ) : null}

            <Tabs type="primary" defaultValue="overview">
              <TabsList
                className="w-full rounded-none border-b border-border-primary bg-transparent p-0"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0 }}
              >
                <TabsTrigger className="w-full rounded-none" style={{ justifyContent: 'center', textAlign: 'center' }} value="overview">Overview</TabsTrigger>
                <TabsTrigger className="w-full rounded-none" style={{ justifyContent: 'center', textAlign: 'center' }} value="reconciliation">Reconciliation</TabsTrigger>
                <TabsTrigger className="w-full rounded-none" style={{ justifyContent: 'center', textAlign: 'center' }} value="exceptions">Exceptions</TabsTrigger>
                <TabsTrigger className="w-full rounded-none" style={{ justifyContent: 'center', textAlign: 'center' }} value="audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="flex flex-col gap-4">
                  {showPreview ? (
                    onPreview ? (
                      <button
                        type="button"
                        onClick={onPreview}
                        className="group flex w-full items-center gap-4 rounded-xl border border-border-primary bg-[var(--bg-secondary)] p-4 text-left transition-colors hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                      >
                        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-[var(--bg-primary)]">
                          <img
                            src={previewUrl ?? undefined}
                            alt={item.fileName}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <Typography variant="body-primary-medium" color="primary">
                            Preview uploaded image
                          </Typography>
                          <Typography variant="body-secondary-regular" color="secondary" className="truncate">
                            {item.fileName}
                          </Typography>
                          <Typography variant="body-secondary-regular" color="tertiary">
                            Click to open the full-size preview
                          </Typography>
                        </div>
                      </button>
                    ) : (
                      <div className="group flex w-full items-center gap-4 rounded-xl border border-border-primary bg-[var(--bg-secondary)] p-4 text-left">
                        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-[var(--bg-primary)]">
                          <img
                            src={previewUrl ?? undefined}
                            alt={item.fileName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <Typography variant="body-primary-medium" color="primary">
                            Preview uploaded image
                          </Typography>
                          <Typography variant="body-secondary-regular" color="secondary" className="truncate">
                            {item.fileName}
                          </Typography>
                          <Typography variant="body-secondary-regular" color="tertiary">
                            Preview handler unavailable
                          </Typography>
                        </div>
                      </div>
                    )
                  ) : null}

                  <OverviewCard title="System shipment data" fields={getSystemShipmentFields(item)} />

                  <div className="flex flex-col py-1" style={{ gap: rem14(12) }}>
                    <Typography variant="body-primary-medium" color="primary" className="text-[1rem] font-semibold leading-6">
                      ePOD extracted information
                    </Typography>
                    {reconciliationBadgeStatuses.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {reconciliationBadgeStatuses.map((status) => (
                          <div key={status} className="inline-flex w-fit">
                            <Badge variant={RECON_STATUS_META[status].variant}>{RECON_STATUS_META[status].label}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead colorVariant="bg" style={{ width: '20%' }}>
                            Labels
                          </TableHead>
                          <TableHead colorVariant="bg" className="border-l border-[var(--border-primary)]" style={{ width: '12%' }}>
                            Shipment details
                          </TableHead>
                          <TableHead colorVariant="bg" className="border-l border-[var(--border-primary)]" style={{ width: '38%' }}>
                            OCR extracted details
                          </TableHead>
                          <TableHead colorVariant="bg" className="border-l border-[var(--border-primary)]" style={{ width: '16%' }}>
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonRows.map((row) => (
                          <TableRow key={row.label}>
                            <TableCell
                              lineVariant="multi"
                              className={TABLE_CELL_ROW_HOVER_BORDER}
                              style={{ verticalAlign: 'top', width: '20%' }}
                            >
                              <Typography variant="body-secondary-medium" color="primary">
                                {row.label}
                              </Typography>
                            </TableCell>
                            <TableCell
                              lineVariant="multi"
                              className={`border-l border-[var(--border-primary)] ${TABLE_CELL_ROW_HOVER_BORDER}`}
                              style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', width: '12%' }}
                            >
                              {row.shipmentDetails}
                            </TableCell>
                            <TableCell
                              lineVariant="multi"
                              className={`border-l border-[var(--border-primary)] ${TABLE_CELL_ROW_HOVER_BORDER}`}
                              style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', width: '38%' }}
                            >
                              {readOnly ? (
                                row.ocrDetails
                              ) : row.key === 'awb' ? (
                                <Input>
                                  <InputField
                                    value={draft.extractedAwb ?? ''}
                                    onChange={(event) => updateDraft({ extractedAwb: event.target.value || null })}
                                    placeholder="Enter AWB number"
                                  />
                                </Input>
                              ) : row.key === 'consignee' ? (
                                <Input>
                                  <InputField
                                    value={draft.extractedConsignee ?? ''}
                                    onChange={(event) => updateDraft({ extractedConsignee: event.target.value || null })}
                                    placeholder="Enter consignee name"
                                  />
                                </Input>
                              ) : row.key === 'deliveryDate' ? (
                                <Input>
                                  <InputField
                                    value={draft.extractedDeliveryDate ?? ''}
                                    onChange={(event) => updateDraft({ extractedDeliveryDate: event.target.value || null })}
                                    placeholder="Enter delivery date"
                                  />
                                </Input>
                              ) : row.key === 'lineItems' ? (
                                <Textarea>
                                  <TextareaField
                                    value={draft.description ?? ''}
                                    onChange={(event) => updateDraft({ description: event.target.value || null })}
                                    placeholder="Enter SKU / item description"
                                    rows={3}
                                  />
                                </Textarea>
                              ) : row.key === 'quantities' ? (
                                <Textarea>
                                  <TextareaField
                                    value={draft.receivedQuantityNotes ?? ''}
                                    onChange={(event) => updateDraft({ receivedQuantityNotes: event.target.value || null })}
                                    placeholder="Enter received quantities"
                                    rows={3}
                                  />
                                </Textarea>
                              ) : row.key === 'remarks' ? (
                                <Textarea>
                                  <TextareaField
                                    value={draft.remarks ?? ''}
                                    onChange={(event) => updateDraft({ remarks: event.target.value || null })}
                                    placeholder="Enter damage or shortage remarks"
                                    rows={3}
                                  />
                                </Textarea>
                              ) : row.key === 'stamp' ? (
                                <RadioGroup
                                  name={`stamp-status-${item.id}`}
                                  value={
                                    draft.stampPresent === true ? 'present' : draft.stampPresent === false ? 'missing' : ''
                                  }
                                  onValueChange={(next) => updateDraft({ stampPresent: next === 'present' })}
                                  size="sm"
                                  orientation="vertical"
                                  className="gap-2"
                                >
                                  <RadioItem value="present">
                                    <RadioItemInput />
                                    <RadioItemLabel>Present</RadioItemLabel>
                                  </RadioItem>
                                  <RadioItem value="missing">
                                    <RadioItemInput />
                                    <RadioItemLabel>Missing</RadioItemLabel>
                                  </RadioItem>
                                </RadioGroup>
                              ) : (
                                row.ocrDetails
                              )}
                            </TableCell>
                            <TableCell
                              lineVariant="multi"
                              className={`border-l border-[var(--border-primary)] ${TABLE_CELL_ROW_HOVER_BORDER}`}
                              style={{ verticalAlign: 'top', width: '16%' }}
                            >
                              <MatchStatusBadge status={row.matchStatus} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {!readOnly ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button variant="primary" onClick={() => void handleSaveDrawerDraft()} disabled={!hasDraftChanges} loading={isSavingDraft}>
                          Save OCR changes
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reconciliation">
                <ReconciliationTab
                  item={item}
                  readOnly={readOnly}
                  onLineReview={onLineReview}
                  onLineOverride={onLineOverride}
                />
              </TabsContent>

              <TabsContent value="exceptions">
                <div className="flex flex-col" style={{ gap: rem14(12) }}>
                  {item.exceptions.length === 0 ? (
                    <Alert variant="success">No exceptions detected for this POD.</Alert>
                  ) : (
                    item.exceptions.map((exception) => (
                      <Card key={exception.id}>
                        <CardBody>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-2">
                              <ExceptionBadge type={exception.type} severity={exception.severity} />
                              <Typography variant="body-primary-regular" color="primary">
                                {exception.description}
                              </Typography>
                            </div>
                            {!readOnly && !exception.resolved ? (
                              <Button variant="secondary" size="sm" onClick={() => onResolveException(exception.id)}>
                                Mark resolved
                              </Button>
                            ) : null}
                          </div>
                        </CardBody>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="audit">
                <div className="flex flex-col" style={{ gap: rem14(12) }}>
                  {item.auditTrail.map((event) => (
                    <Card key={event.id}>
                      <CardBody>
                        <div className="flex flex-col gap-1">
                          <Typography variant="body-primary-medium" color="primary">{event.description}</Typography>
                          <Typography variant="body-secondary-regular" color="secondary">
                            {event.actor} • {new Date(event.timestamp).toLocaleString()}
                          </Typography>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DrawerBody>
        <DrawerFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex items-center gap-3">
              {footerActions}
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
