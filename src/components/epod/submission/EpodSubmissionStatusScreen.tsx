import { Badge, Button, Icon, ProgressBar, Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';
import type { EpodSubmissionJobStatus } from '@/lib/epod/types';

export type EpodSubmissionStatusScreenVariant = EpodSubmissionJobStatus;

export interface EpodSubmissionStatusScreenProps {
  status: EpodSubmissionStatusScreenVariant;
  totalFiles: number;
  submittedCount?: number;
  failedCount?: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  subtitle?: string;
}

function getStatusMeta(status: EpodSubmissionStatusScreenVariant) {
  switch (status) {
    case 'success':
      return {
        icon: 'check' as const,
        circleColor: 'var(--color-positive)',
        badgeVariant: 'success' as const,
        badgeLabel: 'Completed',
      };
    case 'failed':
      return {
        icon: 'warning' as const,
        circleColor: 'var(--color-critical)',
        badgeVariant: 'danger' as const,
        badgeLabel: 'Failed',
      };
    case 'cancelled':
      return {
        icon: 'warning' as const,
        circleColor: 'var(--text-secondary)',
        badgeVariant: 'secondary' as const,
        badgeLabel: 'Cancelled',
      };
    default:
      return {
        icon: 'clock' as const,
        circleColor: 'var(--text-primary)',
        badgeVariant: 'warning' as const,
        badgeLabel: 'In progress',
      };
  }
}

function getTitle(status: EpodSubmissionStatusScreenVariant, totalFiles: number, submittedCount?: number, failedCount?: number) {
  if (status === 'failed') {
    return `${failedCount ?? 0}/${totalFiles} Loads failed to submit`;
  }

  if (status === 'cancelled') {
    return 'Submission job cancelled';
  }

  return `${submittedCount ?? 0}/${totalFiles} Loads submitted`;
}

export function EpodSubmissionStatusScreen({
  status,
  totalFiles,
  submittedCount,
  failedCount,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  subtitle,
}: EpodSubmissionStatusScreenProps) {
  const meta = getStatusMeta(status);
  const title = getTitle(status, totalFiles, submittedCount, failedCount);
  const progressValue = totalFiles > 0 ? Math.min(100, Math.round(((submittedCount ?? 0) / totalFiles) * 100)) : 0;

  return (
    <div className="flex min-h-[560px] items-center justify-center rounded-[20px] border border-border-secondary bg-bg-primary px-6 py-16">
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center text-center" style={{ gap: rem14(16) }}>
        <div className="flex items-center justify-center">
          {status === 'in_progress' ? (
            <ProgressBar
              type="circle"
              value={progressValue}
              variant="active"
              width={72}
              strokeWidth={8}
              animated
              format={() => null}
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${meta.circleColor} 14%, var(--surface-alt))`,
                color: meta.circleColor,
              }}
            >
              <Icon name={meta.icon} size={24} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center" style={{ gap: rem14(8) }}>
          <Badge variant={meta.badgeVariant}>{meta.badgeLabel}</Badge>
          <Typography variant="title-secondary" color="primary">
            {title}
          </Typography>
          <Typography variant="body-primary-regular" color="secondary">
            {subtitle || (status === 'in_progress' ? 'This may take a few moments.' : 'Submission has been processed.')}
          </Typography>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onSecondaryAction && secondaryActionLabel ? (
            <Button variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
