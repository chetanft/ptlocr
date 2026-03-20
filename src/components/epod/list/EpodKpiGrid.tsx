import { Card, CardBody, Icon, Typography } from 'ft-design-system';

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
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {KPI_CONFIG.map((card) => {
        const isActive = activeStatus === card.status;
        return (
          <Card
            key={card.status}
            bordered
            className="cursor-pointer"
            onClick={() => onStatusChange(card.status)}
            style={{
              backgroundColor: isActive ? 'var(--border-secondary)' : 'var(--bg-primary)',
            }}
          >
            <CardBody>
              <div className="flex flex-col gap-[8px]">
                <Typography
                  variant="body-primary-medium"
                  style={{ fontSize: 'clamp(1.75rem, 1.5rem + 0.8vw, 2.25rem)', color: card.color, lineHeight: 1.2 }}
                >
                  {counts[card.status]}
                </Typography>
                <div className="flex items-center gap-2">
                  <Icon name={card.icon} size={20} />
                  <Typography
                    variant="display-primary"
                    color="primary"
                    style={{ fontSize: 'clamp(1.125rem, 1.02rem + 0.35vw, 1.375rem)', lineHeight: 1.2 }}
                  >
                    {card.status}
                  </Typography>
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
