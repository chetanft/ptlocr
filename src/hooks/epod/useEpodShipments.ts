import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import extractedShipments from '@/data/epodExtractedShipments.json';
import { getShipmentStatusOverrides, subscribeShipmentStatusOverrides } from '@/lib/epod/shipmentStatusStore';
import type { EpodShipmentRow } from '@/lib/epod/types';

const STATUS_VALUES = ['Pending Submission', 'Pending Approval', 'Rejected', 'Approved'] as const;

interface ExtractedShipmentRecord {
  awbNumber: string;
  shipmentId: string;
  transporter: string;
  origin: string | null;
  originCity: string | null;
  consigneeName: string | null;
  destination: string | null;
  deliveredDate: string | null;
  packageCount: number;
  sortOrder: number;
}

function toDisplayDate(value: string | null) {
  return value && value.trim() ? value : '—';
}

function getStatusForIndex(index: number, total: number): EpodShipmentRow['status'] {
  const approvalCutoff = Math.floor(total * 0.7);
  const rejectedCutoff = Math.floor(total * 0.85);
  const approvedCutoff = Math.floor(total * 0.93);

  if (index < approvalCutoff) return 'Pending Submission';
  if (index < rejectedCutoff) return 'Pending Approval';
  if (index < approvedCutoff) return 'Rejected';
  return 'Approved';
}

function toShipmentRow(record: ExtractedShipmentRecord, index: number, total: number, statusOverride?: EpodShipmentRow['status']): EpodShipmentRow {
  const uploadedAt =
    record.deliveredDate && (statusOverride ?? getStatusForIndex(index, total)) !== 'Pending Submission'
      ? `${record.deliveredDate} 10:30`
      : undefined;

  return {
    awbNumber: record.awbNumber,
    shipmentId: record.shipmentId,
    consigneeName: record.consigneeName || '—',
    origin: record.origin || '—',
    originCity: record.originCity || '—',
    destination: record.destination || '—',
    transporter: record.transporter,
    packageCount: record.packageCount || 0,
    deliveredDate: toDisplayDate(record.deliveredDate),
    uploadedAt,
    status: statusOverride ?? getStatusForIndex(index, total),
  };
}

const SORTED_SHIPMENTS = (extractedShipments as ExtractedShipmentRecord[])
  .sort((left, right) => left.sortOrder - right.sortOrder);

export function useEpodShipments() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusVersion, setStatusVersion] = useState(0);

  useEffect(() => subscribeShipmentStatusOverrides(() => setStatusVersion((value) => value + 1)), []);

  const statusOverrides = useMemo(() => getShipmentStatusOverrides(), [statusVersion]);

  const scopedRecords = useMemo(() => {
    if (user?.role === 'Transporter') {
      return SORTED_SHIPMENTS.filter((record) => record.transporter === user.companyDisplayName);
    }
    return SORTED_SHIPMENTS;
  }, [user?.companyDisplayName, user?.role]);

  const scopedShipments = useMemo(
    () => scopedRecords.map((record, index) => toShipmentRow(record, index, scopedRecords.length, statusOverrides[record.awbNumber])),
    [scopedRecords, statusOverrides],
  );

  const shipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return scopedShipments;

    return scopedShipments.filter((shipment) =>
      shipment.awbNumber.toLowerCase().includes(query) ||
      shipment.shipmentId.toLowerCase().includes(query) ||
      shipment.consigneeName.toLowerCase().includes(query) ||
      shipment.destination.toLowerCase().includes(query) ||
      shipment.transporter.toLowerCase().includes(query) ||
      shipment.origin.toLowerCase().includes(query),
    );
  }, [scopedShipments, search]);

  const counts = useMemo(() => ({
    'Pending Submission': shipments.filter((shipment) => shipment.status === 'Pending Submission').length,
    'Pending Approval': shipments.filter((shipment) => shipment.status === 'Pending Approval').length,
    Rejected: shipments.filter((shipment) => shipment.status === 'Rejected').length,
    Approved: shipments.filter((shipment) => shipment.status === 'Approved').length,
  }), [shipments]);

  return {
    shipments,
    counts,
    search,
    setSearch,
  };
}
