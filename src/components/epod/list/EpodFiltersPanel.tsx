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

const SELECT_TRIGGER_RADIUS = 'rounded-md';

interface EpodFiltersPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  transporterFilter: string;
  onTransporterFilterChange: (value: string) => void;
}

/** Matches SelectItem value so SelectValue shows this label on first paint (design system only sets label after a click). */
const ALL_TRANSPORTERS = 'all';

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
    <div className="flex items-center flex-wrap gap-4">
      <Select key="mdc" defaultValue="MDC">
        <SelectTrigger className={SELECT_TRIGGER_RADIUS} style={{ width: rem14(160) }}>
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MDC">MDC</SelectItem>
          <SelectItem value="warehouse">Delhi DC</SelectItem>
        </SelectContent>
      </Select>

      <DatePicker
        range
        startValue={startDate}
        endValue={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
      />

      {user?.role !== 'Transporter' ? (
        <Select value={transporterFilter} onValueChange={onTransporterFilterChange}>
          <SelectTrigger className={SELECT_TRIGGER_RADIUS} style={{ width: rem14(236) }}>
            <SelectValue placeholder="All Transporters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TRANSPORTERS}>All Transporters</SelectItem>
            <SelectItem value="MEC">MEC</SelectItem>
            <SelectItem value="Om Logistics">Om Logistics</SelectItem>
            <SelectItem value="Safexpress">Safexpress</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <div className="relative z-10 flex items-center rounded-md overflow-hidden" style={{ minWidth: rem14(300) }}>
        <Select key="load-type" defaultValue="All">
          <SelectTrigger className="rounded-l-md rounded-r-none border-r-0 bg-bg-secondary" style={{ width: rem14(120) }}>
            <SelectValue placeholder="All Loads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Loads</SelectItem>
            <SelectItem value="surface">Surface Loads</SelectItem>
            <SelectItem value="priority">Priority Loads</SelectItem>
          </SelectContent>
        </Select>
        <Input className="flex-1 rounded-r-md rounded-l-none">
          <InputField
            placeholder="Search AWB, shipment ID or consignee"
            leadingIcon="search"
            className="rounded-l-none rounded-r-md border border-solid border-border-primary"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
          />
        </Input>
      </div>

      <Button
        variant="text"
        icon="filter"
        iconPosition="only"
        size="md"
        className={SELECT_TRIGGER_RADIUS}
        aria-label="Filter"
      />
    </div>
  );
}
