import { Card, Icon, Statistic, StatisticTitle, StatisticValue } from 'ft-design-system';

interface PodStats {
    total: number;
    pending: number;
    exceptions: number;
    approved: number;
}

export function PodStatsCards({ stats }: { stats: PodStats }) {
    const cards = [
        { label: 'Total PODs', value: stats.total, icon: 'data-stack' as const, color: 'var(--color-neutral)' },
        { label: 'Pending Review', value: stats.pending, icon: 'clock' as const, color: 'var(--color-warning)' },
        { label: 'Exceptions', value: stats.exceptions, icon: 'warning' as const, color: 'var(--color-critical)' },
        { label: 'Approved', value: stats.approved, icon: 'check' as const, color: 'var(--color-positive)' },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
                <Card key={card.label} bordered size="sm">
                    <div className="flex items-center justify-between p-4">
                        <Statistic>
                            <StatisticTitle>{card.label}</StatisticTitle>
                            <StatisticValue>{card.value}</StatisticValue>
                        </Statistic>
                        <div style={{ color: card.color }}>
                            <Icon name={card.icon} size={24} />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
