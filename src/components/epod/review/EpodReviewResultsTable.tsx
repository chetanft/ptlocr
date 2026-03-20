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
  Typography,
} from 'ft-design-system';
import type { ProcessedItem } from '@/lib/epodApi';
import { rem14 } from '@/lib/rem';

interface EpodReviewResultsTableProps {
  items: ProcessedItem[];
  onView?: (item: ProcessedItem) => void;
}

export function EpodReviewResultsTable({
  items,
  onView,
}: EpodReviewResultsTableProps) {
  return (
    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
      <TableHeader>
        <TableRow>
          <TableHead colorVariant="bg" style={{ width: '11%' }}>AWB Number</TableHead>
          <TableHead colorVariant="bg" style={{ width: '10%' }}>Shipment ID</TableHead>
          <TableHead colorVariant="bg" style={{ width: '11%' }}>From</TableHead>
          <TableHead colorVariant="bg" style={{ width: '11%' }}>To</TableHead>
          <TableHead colorVariant="bg" style={{ width: '9%' }}>Transporter</TableHead>
          <TableHead colorVariant="bg" style={{ width: '12%' }}>Attachment</TableHead>
          <TableHead colorVariant="bg" style={{ width: '10%' }}>Status</TableHead>
          <TableHead colorVariant="bg" style={{ width: '8%' }}>Data Confidence</TableHead>
          <TableHead colorVariant="bg" style={{ width: '13%' }}>Reason</TableHead>
          <TableHead className="text-center" colorVariant="bg" style={{ width: '5%' }}>
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} style={{ padding: rem14(24) }}>
              <Typography variant="body-primary-regular" color="tertiary">
                No processed ePOD images for this filter.
              </Typography>
            </TableCell>
          </TableRow>
        ) : null}

        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell style={{ verticalAlign: 'top' }}>{item.awbNumber || '—'}</TableCell>
            <TableCell style={{ verticalAlign: 'top' }}>{item.shipmentId || '—'}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Typography variant="body-secondary-regular" color="primary">{item.fromName || '—'}</Typography>
                {item.fromSubtext ? (
                  <Typography variant="body-secondary-regular" color="secondary">{item.fromSubtext}</Typography>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Typography variant="body-secondary-regular" color="primary">{item.toName || '—'}</Typography>
                {item.toSubtext ? (
                  <Typography variant="body-secondary-regular" color="secondary">{item.toSubtext}</Typography>
                ) : null}
              </div>
            </TableCell>
            <TableCell style={{ verticalAlign: 'top' }}>{item.transporter || '—'}</TableCell>
            <TableCell>
              <span className="inline-flex max-w-full items-center gap-2 overflow-hidden text-brand-primary">
                <Icon name="image" size={16} />
                <span className="truncate" title={item.fileName}>{item.fileName}</span>
              </span>
            </TableCell>
            <TableCell>
              <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
            </TableCell>
            <TableCell style={{ verticalAlign: 'top' }}>{item.confidenceLabel}</TableCell>
            <TableCell style={{ verticalAlign: 'top' }}>
              <div className="max-w-full truncate" title={item.reason}>
                {item.reason}
              </div>
            </TableCell>
            <TableCell>
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
  );
}
