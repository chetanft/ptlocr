import { Card, CardBody, Typography } from 'ft-design-system';
import type { EpodProcessingFilter } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

interface EpodReviewKpiGridProps {
  mode?: 'process' | 'review';
  totalAwbs: number;
  totalUploadedImages: number;
  matchedCount: number;
  needReviewCount: number;
  skippedCount: number;
  unmappedCount: number;
  activeFilter: EpodProcessingFilter;
  onFilterChange: (filter: EpodProcessingFilter) => void;
}

const PROCESS_KPI_CONFIG = [
  { key: 'totalAwbs', label: 'Total AWBs', tone: 'primary', filter: 'all' },
  { key: 'totalUploadedImages', label: 'Total uploaded images', tone: 'primary', filter: 'all' },
  { key: 'matchedCount', label: 'Matched', tone: 'success', filter: 'matched' },
  { key: 'needReviewCount', label: 'Need Review', tone: 'warning', filter: 'needsReview' },
  { key: 'skippedCount', label: 'Skipped', tone: 'danger', filter: 'skipped' },
  { key: 'unmappedCount', label: 'Unmapped images', tone: 'secondary', filter: 'unmapped' },
] as const;

const REVIEW_KPI_CONFIG = [
  { key: 'totalUploadedImages', label: 'Total files', tone: 'primary', filter: 'all' },
  { key: 'matchedCount', label: 'Matched', tone: 'success', filter: 'matched' },
  { key: 'needReviewCount', label: 'Manually matched', tone: 'secondary', filter: 'needsReview' },
  { key: 'skippedCount', label: 'Skipped', tone: 'danger', filter: 'skipped' },
] as const;

const STATUS_VALUE_COLORS = {
  primary: '#44526B',
  success: '#00C73C',
  warning: '#FF5A1F',
  danger: '#FF3B30',
  secondary: '#8B96A8',
} as const;

function getValueColor(tone: string) {
  switch (tone) {
    case 'success':
      return STATUS_VALUE_COLORS.success;
    case 'warning':
      return STATUS_VALUE_COLORS.warning;
    case 'danger':
      return STATUS_VALUE_COLORS.danger;
    case 'secondary':
      return STATUS_VALUE_COLORS.secondary;
    default:
      return STATUS_VALUE_COLORS.primary;
  }
}

export function EpodReviewKpiGrid(props: EpodReviewKpiGridProps) {
  const mode = props.mode ?? 'process';
  const kpiConfig = mode === 'review' ? REVIEW_KPI_CONFIG : PROCESS_KPI_CONFIG;
  const totalFiles = props.totalUploadedImages || props.totalAwbs;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${kpiConfig.length}, minmax(0, 1fr))`,
        gap: rem14(16),
      }}
    >
      {kpiConfig.map((item) => {
        const value = item.key === 'totalUploadedImages' ? totalFiles : props[item.key];
        const isActive = props.activeFilter === item.filter;

        return (
          <Card
            key={item.key}
            bordered
            className="h-fit cursor-pointer transition-colors"
            style={{
              backgroundColor: isActive ? 'var(--surface-alt)' : undefined,
            }}
            onClick={() => props.onFilterChange(item.filter)}
          >
            <CardBody className="flex h-fit w-full flex-col">
              <div className="flex flex-col" style={{ gap: rem14(8), padding: `${rem14(4)} 0` }}>
                <Typography
                  variant="title-secondary"
                  style={{ color: getValueColor(item.tone) }}
                >
                  {String(value).padStart(2, '0')}
                </Typography>
                <Typography variant="body-primary-medium" color="secondary">
                  {item.label}
                </Typography>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
