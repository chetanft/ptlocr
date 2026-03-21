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
import { rem14 } from '@/lib/rem';

interface EpodFiltersPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  transporterFilter: string;
  onTransporterFilterChange: (value: string) => void;
}

export function EpodFiltersPanel({
  search,
  onSearchChange,
  transporterFilter,
  onTransporterFilterChange,
}: EpodFiltersPanelProps) {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('2024-08-12');
  const [endDate, setEndDate] = useState('2024-09-12');

  const componentHeight = 'var(--component-height-md)';
  const componentRadius = 'var(--radius-md)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: rem14(16), flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
      {/* Location */}
      <Select key="mdc" defaultValue="MDC">
        <SelectTrigger
          style={{ width: rem14(200), height: componentHeight, flexShrink: 0, borderRadius: componentRadius }}
        >
          <SelectValue placeholder="MDC Labs, Amritsar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MDC">MDC Labs, Amritsar</SelectItem>
          <SelectItem value="warehouse">Delhi DC, Bawana</SelectItem>
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
          <SelectTrigger style={{ width: rem14(200), height: componentHeight, flexShrink: 0, borderRadius: componentRadius }}>
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

      {/* Load Type + Search combo */}
      <div style={{ display: 'flex', alignItems: 'center', minWidth: rem14(280), flexShrink: 1 }}>
        <Select key="load-type" defaultValue="All">
          <SelectTrigger
            style={{
              width: rem14(110),
              height: componentHeight,
              flexShrink: 0,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRight: 'none',
              borderTopLeftRadius: componentRadius,
              borderBottomLeftRadius: componentRadius,
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <SelectValue placeholder="All Loads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Loads</SelectItem>
            <SelectItem value="surface">Surface</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
        <Input style={{ flex: 1, minWidth: rem14(170) }}>
          <InputField
            placeholder="Search loads"
            leadingIcon="search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
            style={{
              height: componentHeight,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderTopRightRadius: componentRadius,
              borderBottomRightRadius: componentRadius,
            }}
          />
        </Input>
      </div>

      {/* Filter icon button */}
      <Button
        variant="secondary"
        icon="filter"
        iconPosition="only"
        size="md"
        aria-label="Filter"
        style={{ width: componentHeight, height: componentHeight, flexShrink: 0, padding: 0, borderRadius: componentRadius }}
      />
    </div>
  );
}
