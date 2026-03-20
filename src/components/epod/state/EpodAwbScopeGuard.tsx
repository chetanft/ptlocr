import type { ReactNode } from 'react';
import type { EpodSelectedShipment } from '@/lib/epod/types';
import { EpodEmptyState } from './EpodEmptyState';

export function EpodAwbScopeGuard({ shipments, children }: { shipments: EpodSelectedShipment[]; children: ReactNode }) {
  if (shipments.length === 0) {
    return (
      <EpodEmptyState
        title="No AWBs selected"
        description="Start from the ePOD list, select the AWBs that need ePOD upload, and open this flow again."
      />
    );
  }

  return <>{children}</>;
}
