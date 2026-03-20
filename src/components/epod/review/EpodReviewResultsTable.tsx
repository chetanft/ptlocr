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
import type { EpodProcessedDisplayRow } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

interface EpodReviewResultsTableProps {
  items: EpodProcessedDisplayRow[];
}

export function EpodReviewResultsTable({
  items,
}: EpodReviewResultsTableProps) {
  const headerStyle = { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={headerStyle}>AWB Number</TableHead>
          <TableHead style={headerStyle}>Shipment ID</TableHead>
          <TableHead style={headerStyle}>From</TableHead>
          <TableHead style={headerStyle}>To</TableHead>
          <TableHead style={headerStyle}>Transporter</TableHead>
          <TableHead style={headerStyle}>Attachment</TableHead>
          <TableHead style={headerStyle}>Status</TableHead>
          <TableHead style={headerStyle}>Data Confidence</TableHead>
          <TableHead style={headerStyle}>Reason</TableHead>
          <TableHead className="text-center" style={headerStyle}>Actions</TableHead>
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

        {items.map((item) => {
          return (
            <TableRow key={item.id}>
              <TableCell>{item.awbNumber}</TableCell>
              <TableCell>{item.shipmentId || '—'}</TableCell>
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
              <TableCell>{item.transporter || '—'}</TableCell>
              <TableCell>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-brand-primary hover:underline"
                  style={{ background: 'transparent', border: 0, padding: 0 }}
                >
                  <Icon name="image" size={16} />
                  {item.fileName}
                </button>
              </TableCell>
              <TableCell>
                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
              </TableCell>
              <TableCell>{item.confidenceLabel}</TableCell>
              <TableCell>{item.reason}</TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="ghost" icon="delete" iconPosition="only" size="sm" disabled />
                  <Button variant="secondary" icon="chevron-right" iconPosition="only" size="sm" disabled />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
