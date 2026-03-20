import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CheckboxInput,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  InputField,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TextareaField,
  TextareaLabel,
  Typography,
} from 'ft-design-system';
import { useEffect, useMemo, useState } from 'react';
import type { ProcessedItem, ProcessedLineItem, ProcessedOcrPatch } from '@/lib/epodApi';
import { ExceptionBadge } from '@/components/pod/ExceptionBadge';
import { rem14 } from '@/lib/rem';

type Role = 'Transporter' | 'Ops' | 'Reviewer';
type DeliveryReviewStatus = 'clean' | 'unclean' | null;

type ReviewDraft = ProcessedOcrPatch & {
  deliveryReviewStatus?: DeliveryReviewStatus;
};

type ReviewedItem = ProcessedItem & {
  ocrData: ProcessedItem['ocrData'] & {
    deliveryReviewStatus?: DeliveryReviewStatus;
  };
};

interface EpodProcessDetailDrawerProps {
  item: ProcessedItem | null;
  open: boolean;
  role: Role;
  onOpenChange: (open: boolean) => void;
  onDocumentAction: (action: 'reject' | 'sendToReviewer' | 'approve') => void;
  onSaveOcrEdits: (patch: ProcessedOcrPatch) => void;
  onLineReview: (lineId: string, action: 'ACCEPTED' | 'REJECTED') => void;
  onLineOverride: (lineId: string) => void;
  onResolveException: (exceptionId: string) => void;
}

function renderValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function createDraftFromItem(item: ProcessedItem): ReviewDraft {
  return {
    extractedAwb: item.ocrData.extractedAwb,
    extractedConsignee: item.ocrData.extractedConsignee,
    extractedDeliveryDate: item.ocrData.extractedDeliveryDate,
    extractedFrom: item.ocrData.extractedFrom,
    extractedTo: item.ocrData.extractedTo,
    stampPresent: item.ocrData.stampPresent,
    signaturePresent: item.ocrData.signaturePresent,
    remarks: item.ocrData.remarks,
    conditionNotes: item.ocrData.conditionNotes,
    deliveryReviewStatus: (item as ReviewedItem).ocrData.deliveryReviewStatus ?? null,
  };
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
            <TableCell>
              <div className="flex flex-col gap-1">
                <Typography variant="body-primary-medium" color="primary">
                  {line.description}
                </Typography>
                <Typography variant="body-secondary-regular" color="secondary">
                  {line.sku ?? '—'}
                </Typography>
              </div>
            </TableCell>
            <TableCell>{line.sentQty}</TableCell>
            <TableCell>{line.receivedQty}</TableCell>
            <TableCell>{line.damagedQty}</TableCell>
            <TableCell>{line.difference}</TableCell>
            <TableCell>
              <Badge variant={line.reconStatus === 'MATCH' ? 'success' : line.reconStatus === 'EXCESS' ? 'warning' : 'danger'}>
                {line.reconStatus}
              </Badge>
            </TableCell>
            {!readOnly ? (
              <TableCell>
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

export function EpodProcessDetailDrawer({
  item,
  open,
  role,
  onOpenChange,
  onDocumentAction,
  onSaveOcrEdits,
  onLineReview,
  onLineOverride,
  onResolveException,
}: EpodProcessDetailDrawerProps) {
  const readOnly = role === 'Transporter';
  const [draft, setDraft] = useState<ReviewDraft | null>(null);

  useEffect(() => {
    setDraft(item ? createDraftFromItem(item) : null);
  }, [item]);

  const hasDraftChanges = useMemo(() => {
    if (!item || !draft) {
      return false;
    }
    const original = createDraftFromItem(item);
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [draft, item]);

  const deliveryReviewStatus = draft?.deliveryReviewStatus ?? null;
  const isClean = deliveryReviewStatus === 'clean';
  const isUnclean = deliveryReviewStatus === 'unclean';

  if (!item || !draft) {
    return null;
  }

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

  const updateDraft = (next: Partial<ReviewDraft>) => {
    setDraft((previous) => ({
      ...(previous ?? createDraftFromItem(item)),
      ...next,
    }));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent placement="right" width={760}>
        <DrawerHeader>
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <DrawerTitle>{item.fileName}</DrawerTitle>
              <div className="flex items-center gap-2">
                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                <Badge variant="secondary">{item.confidenceLabel} confidence</Badge>
                {deliveryReviewStatus ? (
                  <Badge variant={deliveryReviewStatus === 'clean' ? 'success' : 'warning'}>
                    {deliveryReviewStatus === 'clean' ? 'Clean delivery' : 'Unclean delivery'}
                  </Badge>
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

            <Tabs type="primary" showLine defaultValue="overview">
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="flex flex-col rounded-xl border border-border-primary p-6" style={{ gap: rem14(12) }}>
                    <Typography variant="title-secondary" color="primary">
                      Shipment data in system
                    </Typography>
                    <div className="flex flex-col" style={{ gap: rem14(12) }}>
                      {(
                        [
                          ['AWB Number', item.systemData.awbNumber],
                          ['Shipment ID', item.systemData.shipmentId],
                          ['From', item.systemData.fromName],
                          ['From city', item.systemData.fromSubtext],
                          ['To', item.systemData.toName],
                          ['To city', item.systemData.toSubtext],
                          ['Transporter', item.systemData.transporter],
                          ['Delivered Date', item.systemData.deliveredDate],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1">
                          <span className="font-sans text-sm-rem font-medium leading-[1.4] text-[var(--tertiary)]">
                            {label}
                          </span>
                          <span className="font-sans text-sm-rem font-normal leading-[1.4] text-[var(--primary)] whitespace-pre-wrap">
                            {renderValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col rounded-xl border border-border-primary p-6" style={{ gap: rem14(12) }}>
                    <Typography variant="title-secondary" color="primary">OCR extracted POD data</Typography>
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
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2">
                        <CheckboxInput
                          checked={draft.stampPresent ?? false}
                          onChange={(event) => updateDraft({ stampPresent: event.target.checked })}
                          disabled={readOnly}
                        />
                        <Typography variant="body-secondary-regular" color="primary">Stamp present</Typography>
                      </label>
                      <label className="flex items-center gap-2">
                        <CheckboxInput
                          checked={draft.signaturePresent ?? false}
                          onChange={(event) => updateDraft({ signaturePresent: event.target.checked })}
                          disabled={readOnly}
                        />
                        <Typography variant="body-secondary-regular" color="primary">Signature present</Typography>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Typography variant="body-primary-medium" color="primary">Delivery review outcome</Typography>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={isClean ? 'primary' : 'text'}
                          size="sm"
                          onClick={() => updateDraft({ deliveryReviewStatus: 'clean' })}
                          disabled={readOnly}
                        >
                          Clean delivery
                        </Button>
                        <Button
                          variant={isUnclean ? 'primary' : 'text'}
                          size="sm"
                          onClick={() => updateDraft({ deliveryReviewStatus: 'unclean' })}
                          disabled={readOnly}
                        >
                          Unclean delivery
                        </Button>
                        {deliveryReviewStatus ? (
                          <Badge variant={deliveryReviewStatus === 'clean' ? 'success' : 'warning'}>
                            {deliveryReviewStatus === 'clean' ? 'Clean' : 'Unclean'}
                          </Badge>
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
              {!readOnly ? (
                <Button variant="secondary" onClick={() => onSaveOcrEdits(draft as ProcessedOcrPatch)} disabled={!hasDraftChanges}>
                  Save changes
                </Button>
              ) : null}
              {footerActions}
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
