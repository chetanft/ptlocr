import type { ReactNode } from 'react';
import { Button, Icon, Typography } from 'ft-design-system';
import { rem } from '@/lib/rem';

interface EpodPageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  icon?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

export function EpodPageHeader({ title, subtitle, icon, onBack, trailing }: EpodPageHeaderProps) {
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-6"
      style={{ minHeight: rem(88) }}
    >
      {/* Left: Back + Icon + Title */}
      <div className="flex flex-nowrap items-center gap-3 shrink-0 min-w-0">
        {onBack ? (
          <Button variant="text" icon="arrow-left" iconPosition="only" size="md" onClick={onBack} />
        ) : null}
        {icon ? <Icon name={icon} size={24} /> : null}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <Typography variant="title-secondary" color="primary">
              {title}
            </Typography>
          </div>
          {subtitle ? (
            <Typography variant="body-primary-regular" color="tertiary">
              {subtitle}
            </Typography>
          ) : null}
        </div>
      </div>

      {/* Right: Trailing content (same row as title; shrinks combo/search before wrapping) */}
      {trailing ? <div className="flex flex-1 justify-end overflow-hidden">{trailing}</div> : null}
    </div>
  );
}
