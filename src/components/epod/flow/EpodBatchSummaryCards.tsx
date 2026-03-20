import { Card, CardBody, Typography } from 'ft-design-system';
import type { EpodBatchJob } from '@/lib/epod/types';

export function EpodBatchSummaryCards({ batch }: { batch: EpodBatchJob }) {
  const cards = [
    { label: 'Uploaded files', value: batch.totalFiles, color: 'var(--primary)' },
    { label: 'Ready to submit', value: batch.readyCount, color: 'var(--positive)' },
    { label: 'Needs review', value: batch.needsReviewCount, color: 'var(--warning)' },
    { label: 'Unmapped / blocked', value: batch.unmatchedCount + batch.blockedCount, color: 'var(--critical)' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} bordered size="sm">
          <CardBody>
            <div className="flex flex-col gap-1" style={{ padding: 0 }}>
              <Typography variant="title-secondary" style={{ color: card.color }}>
                {card.value}
              </Typography>
              <Typography variant="body-primary-semibold" style={{ color: 'var(--secondary)' }}>
                {card.label}
              </Typography>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
