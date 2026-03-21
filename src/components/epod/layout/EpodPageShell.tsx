import type { ReactNode } from 'react';
import { rem14 } from '@/lib/rem';

interface EpodPageShellProps {
  breadcrumbs?: ReactNode;
  header: ReactNode;
  actionBar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function EpodPageShell({ breadcrumbs, header, actionBar, footer, children }: EpodPageShellProps) {
  return (
    <div className="flex flex-col bg-bg-primary" style={{ minHeight: `calc(100vh - ${rem14(64)})` }}>
      {breadcrumbs && <div style={{ paddingInline: rem14(20), paddingTop: rem14(8) }}>{breadcrumbs}</div>}
      <div style={{ paddingInline: rem14(19), paddingTop: 0, paddingBottom: 0 }}>{header}</div>
      {actionBar && <div style={{ paddingInline: rem14(20), paddingBottom: rem14(16) }}>{actionBar}</div>}
      <div className="flex-1" style={{ paddingInline: rem14(20), paddingTop: rem14(20), paddingBottom: rem14(20) }}>{children}</div>
      {footer}
    </div>
  );
}
