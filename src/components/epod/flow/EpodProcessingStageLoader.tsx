import { Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

const STAGE_LABELS = [
  'Reading uploaded file',
  'Extracting AWB and POD fields',
  'Matching with shipment data',
  'Preparing reconciliation buckets',
] as const;

interface EpodProcessingStageLoaderProps {
  activeStage: number;
  completedFiles: number;
  totalFiles: number;
  mode: 'bulk' | 'selection';
}

export function EpodProcessingStageLoader({
  activeStage,
  completedFiles,
  totalFiles,
  mode,
}: EpodProcessingStageLoaderProps) {
  return (
    <div
      className="rounded-[20px] border border-border-primary bg-surface-primary"
      style={{ padding: rem14(32) }}
    >
      <div className="mx-auto flex max-w-[640px] flex-col items-center" style={{ gap: rem14(24) }}>
        <div className="w-full max-w-[420px]">
          <div className="relative mx-auto flex min-h-[232px] flex-col items-center justify-center">
            {STAGE_LABELS.map((label, index) => {
              const isActive = index === activeStage;
              const isComplete = index < activeStage;
              return (
                <div
                  key={label}
                  className="relative flex w-full items-center justify-center"
                  style={{
                    minHeight: rem14(56),
                    opacity: isActive || isComplete ? 1 : 0.42,
                  }}
                >
                  {index < STAGE_LABELS.length - 1 ? (
                    <div
                      className="absolute left-1/2 top-[50%] -translate-x-1/2"
                      style={{
                        width: 2,
                        height: rem14(56),
                        backgroundColor: isComplete ? 'var(--stroke-primary)' : 'var(--stroke-secondary)',
                        transform: `translateX(-50%) translateY(${rem14(28)})`,
                      }}
                    />
                  ) : null}
                  <div className="flex items-center" style={{ gap: rem14(16) }}>
                    <div
                      className="flex items-center justify-center rounded-full text-white"
                      style={{
                        width: rem14(36),
                        height: rem14(36),
                        backgroundColor: isActive || isComplete ? 'var(--text-primary)' : 'var(--bg-secondary)',
                        boxShadow: isActive ? '0 0 0 6px rgba(74, 88, 116, 0.10)' : undefined,
                      }}
                    >
                      <Typography variant="label-medium" style={{ color: 'inherit' }}>
                        {index + 1}
                      </Typography>
                    </div>
                    <Typography
                      variant={isActive ? 'body-primary-medium' : 'body-primary-regular'}
                      color={isActive || isComplete ? 'primary' : 'tertiary'}
                    >
                      {label}
                    </Typography>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Typography variant="body-primary-regular" color="secondary">
          {mode === 'selection'
            ? 'Preparing stored extracted POD data for reconciliation...'
            : `Processing ${completedFiles} of ${totalFiles || 1} file${(totalFiles || 1) === 1 ? '' : 's'}...`}
        </Typography>
      </div>
    </div>
  );
}
