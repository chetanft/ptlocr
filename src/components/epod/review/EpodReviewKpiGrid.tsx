import { Card, CardBody, Typography } from 'ft-design-system';
import type { EpodProcessingFilter } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

interface EpodReviewKpiGridProps {
  totalAwbs: number;
  totalUploadedImages: number;
  matchedCount: number;
  needReviewCount: number;
  skippedCount: number;
  unmappedCount: number;
  activeFilter: EpodProcessingFilter;
  onFilterChange: (filter: EpodProcessingFilter) => void;
}

const KPI_CONFIG = [
  { key: 'totalAwbs', label: 'Total AWBs', tone: 'primary', filter: 'all' },
  { key: 'totalUploadedImages', label: 'Total uploaded images', tone: 'primary', filter: 'all' },
  { key: 'matchedCount', label: 'Matched', tone: 'success', filter: 'matched' },
  { key: 'needReviewCount', label: 'Need Review', tone: 'warning', filter: 'needsReview' },
  { key: 'skippedCount', label: 'Skipped', tone: 'danger', filter: 'skipped' },
  { key: 'unmappedCount', label: 'Unmapped images', tone: 'secondary', filter: 'unmapped' },
] as const;

function getValueColor(tone: string) {
  switch (tone) {
    case 'success':
      return 'var(--semantic-success-600)';
    case 'warning':
      return 'var(--semantic-warning-600)';
    case 'danger':
      return 'var(--semantic-danger-600)';
    case 'secondary':
      return 'var(--text-secondary)';
    default:
      return 'var(--text-primary)';
  }
}

export function EpodReviewKpiGrid(props: EpodReviewKpiGridProps) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: rem14(16),
      }}
    >
      {KPI_CONFIG.map((item) => {
        const value = props[item.key];
        const isActive = props.activeFilter === item.filter;

        return (
          <Card
            key={item.key}
            bordered
            className="h-fit cursor-pointer transition-all"
            style={{
              borderColor: isActive ? 'var(--primary-700)' : undefined,
              boxShadow: isActive ? '0 0 0 1px var(--primary-700) inset' : undefined,
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
