import {
  Badge,
  Button,
  Icon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Typography,
} from 'ft-design-system';
import {
  getDeliveryStatusLabel,
  getDeliveryStatusVariant,
  getReviewFinalMatchLabel,
  getReviewFinalMatchStatus,
  type ProcessedItem,
  type ReviewFinalMatchStatus,
} from '@/lib/epodApi';
import { rem14 } from '@/lib/rem';

interface EpodReviewResultsTableProps {
  mode?: 'process' | 'review';
  items: ProcessedItem[];
  onView?: (item: ProcessedItem) => void;
  onPreview?: (item: ProcessedItem) => void;
}

export function EpodReviewResultsTable({
  mode = 'process',
  items,
  onView,
  onPreview,
}: EpodReviewResultsTableProps) {
  const reviewWidths = {
    awb: 180,
    shipment: 180,
    attachment: 280,
    match: 200,
    delivery: 160,
    actions: 120,
  } as const;

  const processWidths = {
    awb: 150,
    shipment: 150,
    from: 170,
    to: 170,
    transporter: 130,
    attachment: 220,
    ocrStatus: 130,
    epodStatus: 140,
    confidence: 140,
    reason: 220,
    actions: 120,
  } as const;

  const getFinalMatchVariant = (status: ReviewFinalMatchStatus) => {
    switch (status) {
      case 'rejected':
        return 'danger';
      case 'manually_matched':
        return 'secondary';
      case 'skipped':
        return 'danger';
      default:
        return 'success';
    }
  };

  const renderAttachmentCell = (item: ProcessedItem, isPreviewable: boolean) => {
    const isMissingUpload = item.statusLabel === 'Skipped' || item.fileName.startsWith('No image uploaded for ');
    const attachmentContent = (
      <span className="inline-flex max-w-full items-center gap-2 overflow-hidden text-brand-primary">
        <Icon name="image" size={16} />
        <span className="truncate" title={item.fileName}>
          {item.fileName}
        </span>
      </span>
    );

    if (!isPreviewable || isMissingUpload) {
      if (isMissingUpload) {
        return (
          <span className="inline-flex max-w-full items-center gap-2 overflow-hidden text-[var(--text-primary)]">
            <Icon name="image" size={16} />
            <span className="truncate" title={item.fileName}>
              {item.fileName}
            </span>
          </span>
        );
      }
      return attachmentContent;
    }

    return (
      <Button
        variant="link"
        size="sm"
        onClick={() => onPreview?.(item)}
        aria-label={`Preview ${item.fileName}`}
        style={{ padding: 0, height: 'auto', justifyContent: 'flex-start', minWidth: 0 }}
      >
        {attachmentContent}
      </Button>
    );
  };

  const getProcessStatusVariant = (item: ProcessedItem) => {
    if (item.statusLabel === 'Unmapped') {
      return 'secondary' as const;
    }
    return item.statusVariant;
  };

  const getEpodStatusLabel = (item: ProcessedItem) => {
    if (item.finalDocumentDecision === 'clean' || item.deliveryReviewStatus === 'clean') {
      return 'Clean';
    }
    if (item.finalDocumentDecision === 'unclean' || item.deliveryReviewStatus === 'unclean') {
      return 'Unclean';
    }
    if (item.finalDocumentDecision === 'rejected') {
      return 'Rejected';
    }
    if (
      item.reason === 'Marked for manual review' ||
      item.reason === 'Resolved manually and sent to reviewer'
    ) {
      return 'Raised for review';
    }
    return '—';
  };

  const getEpodStatusVariant = (item: ProcessedItem) => {
    const label = getEpodStatusLabel(item);
    if (label === 'Clean') return 'success' as const;
    if (label === 'Unclean') return 'warning' as const;
    if (label === 'Rejected') return 'danger' as const;
    if (label === 'Raised for review') return 'secondary' as const;
    return 'secondary' as const;
  };

  if (mode === 'review') {
    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <Table style={{ tableLayout: 'fixed', width: '100%', minWidth: 1120 }}>
        <TableHeader>
          <TableRow>
            <TableHead colorVariant="bg" style={{ width: reviewWidths.awb, color: 'var(--text-primary)' }}>AWB Number</TableHead>
            <TableHead colorVariant="bg" style={{ width: reviewWidths.shipment, color: 'var(--text-primary)' }}>Shipment ID</TableHead>
            <TableHead colorVariant="bg" style={{ width: reviewWidths.attachment, color: 'var(--text-primary)' }}>Attachment</TableHead>
            <TableHead colorVariant="bg" style={{ width: reviewWidths.match, color: 'var(--text-primary)' }}>Final match status</TableHead>
            <TableHead colorVariant="bg" style={{ width: reviewWidths.delivery, color: 'var(--text-primary)' }}>Delivery status</TableHead>
            <TableHead className="text-center" colorVariant="bg" style={{ width: reviewWidths.actions, color: 'var(--text-primary)' }}>
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} style={{ padding: rem14(24) }}>
                <Typography variant="body-primary-regular" color="tertiary">
                  No processed ePOD images for this filter.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}

          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell style={{ verticalAlign: 'top', width: reviewWidths.awb }}>{item.awbNumber || '—'}</TableCell>
              <TableCell style={{ verticalAlign: 'top', width: reviewWidths.shipment }}>{item.shipmentId || '—'}</TableCell>
              <TableCell style={{ width: reviewWidths.attachment }}>
                {renderAttachmentCell(item, false)}
              </TableCell>
              <TableCell style={{ width: reviewWidths.match }}>
                {(() => {
                  const finalMatchStatus = getReviewFinalMatchStatus(item);
                  return (
                    <Badge variant={getFinalMatchVariant(finalMatchStatus)}>
                      {getReviewFinalMatchLabel(finalMatchStatus)}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell style={{ verticalAlign: 'top', width: reviewWidths.delivery }}>
                <Badge variant={getDeliveryStatusVariant(item.deliveryReviewStatus ?? null)}>
                  {getDeliveryStatusLabel(item.deliveryReviewStatus ?? null)}
                </Badge>
              </TableCell>
              <TableCell style={{ width: reviewWidths.actions }}>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onView?.(item)}>
                    View
                  </Button>
                </div>
              </TableCell>
            </TableRow>
        ))}
      </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <Table style={{ tableLayout: 'fixed', width: '100%', minWidth: 1600 }}>
      <TableHeader>
        <TableRow>
          <TableHead colorVariant="bg" style={{ width: processWidths.awb }}>AWB Number</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.shipment }}>Shipment ID</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.from }}>From</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.to }}>To</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.transporter }}>Transporter</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.attachment }}>Attachment</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.ocrStatus }}>OCR Status</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.epodStatus }}>ePOD Status</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.confidence }}>Data Confidence</TableHead>
          <TableHead colorVariant="bg" style={{ width: processWidths.reason }}>Reason</TableHead>
          <TableHead className="text-center" colorVariant="bg" style={{ width: processWidths.actions }}>
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} style={{ padding: rem14(24) }}>
              <Typography variant="body-primary-regular" color="tertiary">
                No processed ePOD images for this filter.
              </Typography>
            </TableCell>
          </TableRow>
        ) : null}

          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell style={{ verticalAlign: 'top', width: processWidths.awb }}>{item.awbNumber || '—'}</TableCell>
              <TableCell style={{ verticalAlign: 'top', width: processWidths.shipment }}>{item.shipmentId || '—'}</TableCell>
              <TableCell style={{ width: processWidths.from }}>
                <div className="flex flex-col gap-1">
                  <Typography variant="body-secondary-regular" color="primary">{item.fromName || '—'}</Typography>
                  {item.fromSubtext ? (
                    <Typography variant="body-secondary-regular" color="secondary">{item.fromSubtext}</Typography>
                  ) : null}
                </div>
              </TableCell>
              <TableCell style={{ width: processWidths.to }}>
                <div className="flex flex-col gap-1">
                  <Typography variant="body-secondary-regular" color="primary">{item.toName || '—'}</Typography>
                  {item.toSubtext ? (
                    <Typography variant="body-secondary-regular" color="secondary">{item.toSubtext}</Typography>
                  ) : null}
                </div>
              </TableCell>
              <TableCell style={{ verticalAlign: 'top', width: processWidths.transporter }}>{item.transporter || '—'}</TableCell>
              <TableCell style={{ width: processWidths.attachment }}>
                {renderAttachmentCell(item, Boolean(onPreview))}
              </TableCell>
              <TableCell style={{ width: processWidths.ocrStatus }}>
                <Badge variant={getProcessStatusVariant(item)}>{item.statusLabel}</Badge>
              </TableCell>
              <TableCell style={{ width: processWidths.epodStatus }}>
                {getEpodStatusLabel(item) === '—' ? (
                  '—'
                ) : (
                  <Badge variant={getEpodStatusVariant(item)}>{getEpodStatusLabel(item)}</Badge>
                )}
              </TableCell>
              <TableCell style={{ verticalAlign: 'top', width: processWidths.confidence }}>{item.confidenceLabel}</TableCell>
              <TableCell style={{ verticalAlign: 'top', width: processWidths.reason }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div style={{ maxWidth: processWidths.reason - 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'default' }}>
                        {item.reason}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent style={{ maxWidth: 360 }}>
                      {item.reason}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell style={{ width: processWidths.actions }}>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onView?.(item)}>
                    View
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
      </Table>
    </div>
  );
}
