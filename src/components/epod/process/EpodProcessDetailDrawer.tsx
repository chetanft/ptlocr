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
  Typography,
} from 'ft-design-system';
import type { ProcessedItem, ProcessedLineItem } from '@/lib/epodApi';
import { ExceptionBadge } from '@/components/pod/ExceptionBadge';
import { rem14 } from '@/lib/rem';
import { createEpodOcrDraft } from './epodOcrDraft';

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
  previewUrl?: string | null;
  canPreview?: boolean;
  onPreview?: () => void;
}

function renderValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
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
  onLineReview,
  onLineOverride,
  onResolveException,
  previewUrl,
  canPreview,
  onPreview,
}: EpodProcessDetailDrawerProps) {
  const readOnly = role === 'Transporter';
  const draft = item ? createEpodOcrDraft(item) : null;
  const deliveryReviewStatus = draft?.deliveryReviewStatus ?? null;
  const isClean = deliveryReviewStatus === 'clean';
  const isUnclean = deliveryReviewStatus === 'unclean';
  const showPreview = Boolean(previewUrl && canPreview !== false);

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
                      <Typography variant="title-secondary" color="primary" className="text-md">
                        OCR extracted POD data
                      </Typography>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {(
                          [
                            ['Extracted AWB', draft.extractedAwb],
                            ['Extracted Consignee', draft.extractedConsignee],
                            ['Extracted Delivery Date', draft.extractedDeliveryDate],
                            ['Extracted From', draft.extractedFrom],
                            ['Extracted To', draft.extractedTo],
                            ['Remarks', draft.remarks],
                            ['Condition Notes', draft.conditionNotes],
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={draft.stampPresent ? 'success' : 'secondary'}>
                          {draft.stampPresent ? 'Stamp present' : 'Stamp missing'}
                        </Badge>
                        <Badge variant={draft.signaturePresent ? 'success' : 'secondary'}>
                          {draft.signaturePresent ? 'Signature present' : 'Signature missing'}
                        </Badge>
                        {deliveryReviewStatus ? (
                          <Badge variant={deliveryReviewStatus === 'clean' ? 'success' : 'warning'}>
                            {deliveryReviewStatus === 'clean' ? 'Clean delivery' : 'Unclean delivery'}
                          </Badge>
                        ) : null}
                      </div>
                      {!readOnly && onPreview ? (
                        <Button variant="secondary" onClick={onPreview}>
                          Open image review workspace
                        </Button>
                      ) : null}
                    </div>
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
