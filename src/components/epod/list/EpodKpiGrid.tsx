import { Card, CardBody, Icon, Typography } from 'ft-design-system';
import { rem } from '@/lib/rem';

export type EpodStatusFilter = 'Pending Submission' | 'Pending Approval' | 'Rejected' | 'Approved';

interface EpodKpiGridProps {
  counts: Record<EpodStatusFilter, number>;
  activeStatus: EpodStatusFilter;
  onStatusChange: (status: EpodStatusFilter) => void;
}

const KPI_CONFIG: Array<{ status: EpodStatusFilter; icon: string; color: string }> = [
  { status: 'Pending Submission', icon: 'triangle-alert', color: 'var(--primary-700)' },
  { status: 'Pending Approval', icon: 'clock-alert', color: 'var(--warning)' },
  { status: 'Rejected', icon: 'octagon-alert-filled', color: 'var(--critical)' },
  { status: 'Approved', icon: 'check', color: 'var(--positive)' },
];

export function EpodKpiGrid({ counts, activeStatus, onStatusChange }: EpodKpiGridProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4" style={{ gap: rem(16) }}>
      {KPI_CONFIG.map((card) => {
        const isActive = activeStatus === card.status;
        return (
          <div
            key={card.status}
            className="cursor-pointer"
            onClick={() => onStatusChange(card.status)}
            style={{
              backgroundColor: isActive ? 'var(--border-secondary)' : 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: rem(12),
              padding: rem(20),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: rem(8) }}>
              <Typography
                variant="body-primary-medium"
                style={{ fontSize: rem(32), color: card.color, lineHeight: 1.2 }}
              >
                {counts[card.status]}
              </Typography>
              <div style={{ display: 'flex', alignItems: 'center', gap: rem(8) }}>
                <Icon name={card.icon} size={20} />
                <Typography
                  variant="display-primary"
                  color="primary"
                  style={{ fontSize: rem(20), lineHeight: 1.2 }}
                >
                  {card.status}
                </Typography>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
