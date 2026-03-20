import { Badge, Typography } from 'ft-design-system';
import type { EpodException } from '@/lib/epod/types';

export function EpodExceptionList({ exceptions }: { exceptions: EpodException[] }) {
  if (exceptions.length === 0) {
    return <Typography variant="body-secondary-regular" color="tertiary">No exceptions</Typography>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {exceptions.map((exception) => (
        <Badge key={exception.id} variant={exception.severity === 'HIGH' ? 'danger' : 'warning'}>
          {exception.description || exception.type}
        </Badge>
      ))}
    </div>
  );
}
