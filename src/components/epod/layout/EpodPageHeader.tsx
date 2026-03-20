import type { ReactNode } from 'react';
import { Button, Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

interface EpodPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

export function EpodPageHeader({ title, subtitle, onBack, trailing }: EpodPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ minHeight: rem14(88) }}>
      {/* Left: Back + Title */}
      <div className="flex items-center gap-3 shrink-0">
        {onBack ? (
          <Button variant="text" icon="arrow-left" iconPosition="only" size="md" onClick={onBack} />
        ) : null}
        <div className="flex flex-col">
          <Typography variant="title-secondary" color="primary">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body-primary-regular" color="tertiary">
              {subtitle}
            </Typography>
          ) : null}
        </div>
      </div>

      {/* Right: Trailing content (filters, actions, etc.) */}
      {trailing}
    </div>
  );
}
