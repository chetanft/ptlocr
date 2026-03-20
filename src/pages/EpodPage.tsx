import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { getEpodUploadPathForRole } from '@/auth/routeUtils';
import { EpodPageHeader } from '@/components/epod/layout/EpodPageHeader';
import { EpodPageShell } from '@/components/epod/layout/EpodPageShell';
import { EpodFiltersPanel } from '@/components/epod/list/EpodFiltersPanel';
import { EpodKpiGrid, type EpodStatusFilter } from '@/components/epod/list/EpodKpiGrid';
import { EpodShipmentTable } from '@/components/epod/list/EpodShipmentTable';
import { EpodTableToolbar } from '@/components/epod/list/EpodTableToolbar';
import { useEpodShipments } from '@/hooks/epod/useEpodShipments';
import type { EpodSelectedShipment } from '@/lib/epod/types';

const ROWS_PER_PAGE = 15;

export default function EpodPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { shipments, counts, search, setSearch } = useEpodShipments();
  const [selectedAwbs, setSelectedAwbs] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<EpodStatusFilter>('Pending Submission');
  const [transporterFilter, setTransporterFilter] = useState('all');

  const filteredShipments = useMemo(
    () =>
      shipments.filter((shipment) => {
        if (shipment.status !== activeStatus) return false;
        if (user?.role === 'Transporter') return true;
        if (transporterFilter === 'all') return true;
        return shipment.transporter === transporterFilter;
      }),
    [shipments, activeStatus, transporterFilter, user?.role],
  );

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / ROWS_PER_PAGE));

  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredShipments.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [currentPage, filteredShipments]);

  const selectedShipments = useMemo<EpodSelectedShipment[]>(
    () => filteredShipments.filter((shipment) => selectedAwbs.has(shipment.awbNumber)),
    [filteredShipments, selectedAwbs],
  );

  const toggleRow = (awbNumber: string) => {
    setSelectedAwbs((previous) => {
      const next = new Set(previous);
      if (next.has(awbNumber)) next.delete(awbNumber);
      else next.add(awbNumber);
      return next;
    });
  };

  const toggleAll = () => {
    const filteredAwbs = filteredShipments.map((shipment) => shipment.awbNumber);
    const allFilteredSelected = filteredAwbs.every((awbNumber) => selectedAwbs.has(awbNumber));

    if (allFilteredSelected) {
      setSelectedAwbs((previous) => {
        const next = new Set(previous);
        filteredAwbs.forEach((awbNumber) => next.delete(awbNumber));
        return next;
      });
      return;
    }

    setSelectedAwbs((previous) => {
      const next = new Set(previous);
      filteredAwbs.forEach((awbNumber) => next.add(awbNumber));
      return next;
    });
  };

  const handleOpenUpload = () => {
    if (!user) return;
    if (selectedShipments.length > 0) {
      navigate(getEpodUploadPathForRole(user.role), {
        state: {
          selectedShipments,
          uploadMode: 'selection',
        },
      });
      return;
    }

    if (user.role === 'Ops') {
      navigate(getEpodUploadPathForRole(user.role), {
        state: {
          selectedShipments: [],
          uploadMode: 'bulk',
        },
      });
      return;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, search, transporterFilter]);

  return (
    <EpodPageShell
      header={(
        <EpodPageHeader
          title="ePOD"
          trailing={(
            <EpodFiltersPanel
              search={search}
              onSearchChange={setSearch}
              transporterFilter={transporterFilter}
              onTransporterFilterChange={setTransporterFilter}
            />
          )}
        />
      )}
    >
      <div className="flex flex-col gap-4">
        <EpodKpiGrid counts={counts} activeStatus={activeStatus} onStatusChange={setActiveStatus} />
        <EpodTableToolbar
          selectedCount={selectedShipments.length}
          totalCount={filteredShipments.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onUpload={handleOpenUpload}
        />
        <EpodShipmentTable
          shipments={paginatedShipments}
          activeStatus={activeStatus}
          selectedAwbs={selectedAwbs}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
        />
      </div>
    </EpodPageShell>
  );
}
