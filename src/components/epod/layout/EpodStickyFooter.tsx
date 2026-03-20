import type { ReactNode } from 'react';
import { rem14 } from '@/lib/rem';

export function EpodStickyFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 bg-bg-primary border-t border-border-secondary"
      style={{ paddingInline: rem14(20), paddingBlock: rem14(16) }}
    >
      {children}
    </div>
  );
}
