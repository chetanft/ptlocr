import {
  Badge,
  Button,
  Card,
  CardBody,
  Icon,
  Statistic,
  StatisticTitle,
  StatisticValue,
  Typography,
} from 'ft-design-system';
import { rem14 } from '@/lib/rem';
import type { EpodSubmissionJobStatus } from '@/lib/epod/types';

export type EpodSubmissionJobCardVariant = 'compact' | 'expanded';

export interface EpodSubmissionJobCardProps {
  title: string;
  jobId: string;
  status: EpodSubmissionJobStatus;
  totalFiles: number;
  submittedCount: number;
  failedCount: number;
  variant?: EpodSubmissionJobCardVariant;
  expanded?: boolean;
  onToggle?: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

const STATUS_META: Record<EpodSubmissionJobStatus, {
  label: string;
  icon: 'clock' | 'check' | 'warning';
  badgeVariant: 'success' | 'warning' | 'danger' | 'secondary';
  accent: string;
}> = {
  in_progress: {
    label: 'In progress',
    icon: 'clock',
    badgeVariant: 'warning',
    accent: 'var(--color-warning)',
  },
  success: {
    label: 'Successful',
    icon: 'check',
    badgeVariant: 'success',
    accent: 'var(--color-positive)',
  },
  failed: {
    label: 'Failed',
    icon: 'warning',
    badgeVariant: 'danger',
    accent: 'var(--color-critical)',
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'warning',
    badgeVariant: 'secondary',
    accent: 'var(--text-secondary)',
  },
};

function formatSummary(status: EpodSubmissionJobStatus, submittedCount: number, failedCount: number, totalFiles: number) {
  if (status === 'failed') {
    return `${failedCount}/${totalFiles} Loads failed to submit`;
  }
  if (status === 'cancelled') {
    return 'Submission cancelled';
  }
  return `${submittedCount}/${totalFiles} Loads submitted`;
}

function StatusGlyph({ status }: { status: EpodSubmissionJobStatus }) {
  const meta = STATUS_META[status];
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{
        backgroundColor: `color-mix(in srgb, ${meta.accent} 14%, var(--surface-alt))`,
        color: meta.accent,
      }}
    >
      <Icon name={meta.icon} size={18} />
    </div>
  );
}

export function EpodSubmissionJobCard({
  title,
  jobId,
  status,
  totalFiles,
  submittedCount,
  failedCount,
  variant = 'expanded',
  expanded = true,
  onToggle,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
}: EpodSubmissionJobCardProps) {
  const meta = STATUS_META[status];
  const summary = formatSummary(status, submittedCount, failedCount, totalFiles);

  if (variant === 'compact') {
    return (
      <Card bordered size="sm" className="shadow-sm">
        <CardBody className="flex items-center justify-between gap-4" style={{ padding: rem14(16) }}>
          <div className="flex items-center gap-3">
            <StatusGlyph status={status} />
            <div className="flex flex-col">
              <Typography variant="body-primary-medium" color="primary">
                {title}
              </Typography>
              <Typography variant="body-secondary-regular" color="secondary">
                {summary}
              </Typography>
            </div>
          </div>

          <Button
            variant="text"
            icon={expanded ? 'minus' : 'plus'}
            iconPosition="only"
            size="sm"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onClick={onToggle}
            disabled={!onToggle}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card bordered size="sm" className="shadow-sm">
      <CardBody className="flex flex-col" style={{ gap: rem14(16), padding: rem14(16) }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col" style={{ gap: rem14(4) }}>
            <Typography variant="title-secondary" color="primary">
              {title}
            </Typography>
            <Typography variant="body-secondary-medium" color="secondary">
              Job ID: {jobId}
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
            <Button
              variant="text"
              icon={expanded ? 'minus' : 'plus'}
              iconPosition="only"
              size="sm"
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
              onClick={onToggle}
              disabled={!onToggle}
            />
          </div>
        </div>

        <Typography variant="body-primary-regular" color="secondary">
          {summary}
        </Typography>

        <div className="grid grid-cols-3 gap-3">
          <Statistic>
            <StatisticTitle>Total files</StatisticTitle>
            <StatisticValue>{totalFiles}</StatisticValue>
          </Statistic>
          <Statistic>
            <StatisticTitle>Submitted</StatisticTitle>
            <StatisticValue>{submittedCount}</StatisticValue>
          </Statistic>
          <Statistic>
            <StatisticTitle>Failed</StatisticTitle>
            <StatisticValue>{failedCount}</StatisticValue>
          </Statistic>
        </div>

        {onSecondaryAction || onPrimaryAction ? (
          <div className="flex flex-wrap items-center gap-3">
            {onSecondaryAction && secondaryActionLabel ? (
              <Button variant="secondary" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            ) : null}
            {onPrimaryAction && primaryActionLabel ? (
              <Button variant="primary" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
