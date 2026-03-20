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
import { rem14 } from '@/lib/rem';
import type { EpodSubmissionJobItem } from '@/lib/epod/types';

export interface EpodSubmissionResultTableProps {
  items: EpodSubmissionJobItem[];
  onViewItem?: (item: EpodSubmissionJobItem) => void;
  onRetryItem?: (item: EpodSubmissionJobItem) => void;
}

function renderAttachmentLabel(attachments: string[]) {
  if (attachments.length === 0) {
    return '—';
  }

  if (attachments.length === 1) {
    return attachments[0];
  }

  return `${attachments[0]} + ${attachments.length - 1}`;
}

export function EpodSubmissionResultTable({
  items,
  onViewItem,
  onRetryItem,
}: EpodSubmissionResultTableProps) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border-secondary bg-bg-primary">
      <Table style={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: '18%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                Load ID
              </Typography>
            </TableHead>
            <TableHead style={{ width: '18%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                LR Number
              </Typography>
            </TableHead>
            <TableHead style={{ width: '18%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                Vehicle Info
              </Typography>
            </TableHead>
            <TableHead style={{ width: '18%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                Attachments
              </Typography>
            </TableHead>
            <TableHead style={{ width: '14%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                Status
              </Typography>
            </TableHead>
            <TableHead className="text-center" style={{ width: '14%' }}>
              <Typography variant="body-secondary-medium" color="primary">
                Actions
              </Typography>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} style={{ padding: rem14(24) }}>
                <Typography variant="body-primary-regular" color="tertiary">
                  No job rows available.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}

          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell style={{ verticalAlign: 'top' }}>{item.awbNumber || '—'}</TableCell>
              <TableCell style={{ verticalAlign: 'top' }}>{item.shipmentId || '—'}</TableCell>
              <TableCell style={{ verticalAlign: 'top' }}>{item.vehicleInfo || '—'}</TableCell>
              <TableCell>
                <span className="inline-flex max-w-full items-center gap-2 overflow-hidden text-brand-primary">
                  <Icon name="image" size={16} />
                  <span className="truncate" title={item.fileName}>
                    {renderAttachmentLabel([item.fileName])}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={item.status === 'Submitted' ? 'success' : item.status === 'Failed' ? 'danger' : 'secondary'}>
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="text"
                    icon="delete"
                    iconPosition="only"
                    size="sm"
                    aria-label={item.status === 'Failed' ? 'Retry submission' : 'Remove from submission job'}
                    disabled={item.status !== 'Failed' || !onRetryItem}
                    onClick={() => onRetryItem?.(item)}
                    style={item.status === 'Failed' ? { color: 'var(--color-critical)' } : undefined}
                  />
                  <Button
                    variant="text"
                    icon="chevron-right"
                    iconPosition="only"
                    size="sm"
                    aria-label="View job row details"
                    onClick={() => onViewItem?.(item)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
