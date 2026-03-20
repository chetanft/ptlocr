import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  Button,
  DatePicker,
  Input,
  InputField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'ft-design-system';
import { rem } from '@/lib/rem';

interface EpodFiltersPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  transporterFilter: string;
  onTransporterFilterChange: (value: string) => void;
}

const FILTER_HEIGHT = 40;
const DROPDOWN_WIDTH = 180;

export function EpodFiltersPanel({
  search,
  onSearchChange,
  transporterFilter,
  onTransporterFilterChange,
}: EpodFiltersPanelProps) {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('2024-08-12');
  const [endDate, setEndDate] = useState('2024-09-12');

  return (
    <div className="flex items-center flex-wrap" style={{ gap: rem(12) }}>
      {/* Location */}
      <Select key="mdc" defaultValue="MDC">
        <SelectTrigger style={{ width: rem(DROPDOWN_WIDTH), height: rem(FILTER_HEIGHT) }}>
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MDC">MDC</SelectItem>
          <SelectItem value="warehouse">Delhi DC</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range */}
      <DatePicker
        range
        startValue={startDate}
        endValue={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        size="md"
      />

      {/* Transporter (consignor/ops only) */}
      {user?.role !== 'Transporter' ? (
        <Select value={transporterFilter} onValueChange={onTransporterFilterChange}>
          <SelectTrigger style={{ width: rem(DROPDOWN_WIDTH), height: rem(FILTER_HEIGHT) }}>
            <SelectValue placeholder="All Transporters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transporters</SelectItem>
            <SelectItem value="MEC">MEC</SelectItem>
            <SelectItem value="Om Logistics">Om Logistics</SelectItem>
            <SelectItem value="Safexpress">Safexpress</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {/* Search */}
      <Input style={{ width: rem(240) }}>
        <InputField
          placeholder="Search AWB, shipment"
          leadingIcon="search"
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
          style={{ height: rem(FILTER_HEIGHT) }}
        />
      </Input>

      {/* Filter button — outline, same height as search */}
      <Button
        variant="secondary"
        icon="filter"
        iconPosition="only"
        size="md"
        aria-label="Filter"
      />
    </div>
  );
}
