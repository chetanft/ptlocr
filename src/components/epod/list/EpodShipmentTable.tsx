import {
  Button,
  CheckboxInput,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Typography,
} from 'ft-design-system';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { rem14 } from '@/lib/rem';
import type { EpodShipmentRow } from '@/lib/epod/types';
import type { EpodStatusFilter } from './EpodKpiGrid';
import { TransporterLogo } from './TransporterLogo';

interface EpodShipmentTableProps {
  shipments: EpodShipmentRow[];
  activeStatus: EpodStatusFilter;
  selectedAwbs: Set<string>;
  onToggleRow: (awbNumber: string) => void;
  onToggleAll: () => void;
}

export function EpodShipmentTable({ shipments, activeStatus, selectedAwbs, onToggleRow, onToggleAll }: EpodShipmentTableProps) {
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const showTransporterColumn = user?.role !== 'Transporter';
  const allSelected = shipments.length > 0 && shipments.every((shipment) => selectedAwbs.has(shipment.awbNumber));
  const headerStyle = { backgroundColor: 'var(--tertiary)', color: 'var(--bg-primary)' };
  const stickyHeaderStyle = {
    ...headerStyle,
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
  };
  const tableMinWidth = showTransporterColumn ? rem14(1158) : rem14(938);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop = 0;
  }, [shipments]);

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-primary)]"
      style={{
        width: '100%',
        maxHeight: `calc(100vh - ${rem14(320)})`,
      }}
    >
      <table
        className="w-full border-collapse"
        style={{ minWidth: tableMinWidth }}
      >
        <TableHeader>
          <TableRow>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(72) }}>
              <CheckboxInput checked={allSelected} onChange={onToggleAll} />
            </TableHead>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(220) }}>AWB / Shipment ID</TableHead>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(240) }}>From</TableHead>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(240) }}>To</TableHead>
            {showTransporterColumn ? (
              <TableHead style={{ ...stickyHeaderStyle, width: rem14(220) }}>Transporter</TableHead>
            ) : null}
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(120) }}>Packages</TableHead>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(170) }}>Delivered Date</TableHead>
            <TableHead style={{ ...stickyHeaderStyle, width: rem14(116) }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment, index) => (
            <TableRow key={shipment.awbNumber} style={{ backgroundColor: index % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
              <TableCell style={{ width: rem14(72), height: rem14(96) }}>
                <CheckboxInput checked={selectedAwbs.has(shipment.awbNumber)} onChange={() => onToggleRow(shipment.awbNumber)} />
              </TableCell>
              <TableCell style={{ height: rem14(96) }}>
                <div className="flex flex-col gap-1">
                  <Typography variant="body-secondary-regular" color="primary">{shipment.awbNumber}</Typography>
                  <Typography variant="body-secondary-regular" color="secondary">{shipment.shipmentId}</Typography>
                </div>
              </TableCell>
              <TableCell style={{ height: rem14(96) }}>
                <div className="flex flex-col gap-1">
                  <Typography variant="body-secondary-regular" color="primary">{shipment.origin}</Typography>
                  <Typography variant="body-secondary-regular" color="secondary">{shipment.originCity}</Typography>
                </div>
              </TableCell>
              <TableCell style={{ height: rem14(96) }}>
                <div className="flex flex-col gap-1">
                  <Typography variant="body-secondary-regular" color="primary">{shipment.consigneeName}</Typography>
                  <Typography variant="body-secondary-regular" color="secondary">{shipment.destination}</Typography>
                </div>
              </TableCell>
              {showTransporterColumn ? (
                <TableCell style={{ height: rem14(96) }}>
                  <TransporterLogo name={shipment.transporter} showName={false} />
                </TableCell>
              ) : null}
              <TableCell style={{ height: rem14(96) }}>
                <Typography variant="body-secondary-regular" color="primary">{shipment.packageCount}</Typography>
              </TableCell>
              <TableCell style={{ height: rem14(96) }}>
                <Typography variant="body-secondary-regular" color="primary">{shipment.deliveredDate}</Typography>
              </TableCell>
              <TableCell style={{ width: rem14(116), height: rem14(96) }}>
                <Button
                  variant="ghost"
                  icon="chevron-right"
                  iconPosition="only"
                  size="sm"
                  style={{ borderRadius: rem14(100), border: '1px solid var(--border-primary)' }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
