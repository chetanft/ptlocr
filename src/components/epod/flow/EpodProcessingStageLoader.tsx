import { Icon, Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

const STAGE_LABELS = [
  'Reading uploaded file',
  'Extracting AWB and POD fields',
  'Matching with shipment data',
  'Preparing reconciliation buckets',
] as const;

/** CSS spinner keyframes injected once */
const spinnerStyle = `
@keyframes epod-stage-spinner {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

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
      <style>{spinnerStyle}</style>
      <div className="mx-auto flex max-w-[640px] flex-col items-center" style={{ gap: rem14(24) }}>
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center">
            <div style={{ display: 'flex', flexDirection: 'column', width: rem14(280) }}>
              {STAGE_LABELS.map((label, index) => {
                const isActive = index === activeStage;
                const isComplete = index < activeStage;
                const isFuture = index > activeStage;
                const isLast = index === STAGE_LABELS.length - 1;

                return (
                  <div key={label}>
                    {/* Step row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: rem14(16) }}>
                      {/* Circle */}
                      <div style={{ width: rem14(32), height: rem14(32), position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isComplete ? (
                          /* Completed: dark circle with checkmark */
                          <div style={{
                            width: rem14(24), height: rem14(24), borderRadius: '50%',
                            backgroundColor: 'var(--primary)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon name="check" size={10} style={{ color: '#fff' }} />
                          </div>
                        ) : isActive ? (
                          /* Active: dark circle with spinning arc */
                          <>
                            <div style={{
                              width: rem14(24), height: rem14(24), borderRadius: '50%',
                              backgroundColor: 'var(--primary)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              position: 'relative', zIndex: 1,
                            }}>
                              <Icon name="check" size={10} style={{ color: '#fff' }} />
                            </div>
                            {/* Spinner arc */}
                            <div style={{
                              position: 'absolute', inset: 0,
                              width: rem14(32), height: rem14(32),
                              borderRadius: '50%',
                              border: '2.5px solid transparent',
                              borderTopColor: 'var(--primary)',
                              borderRightColor: 'var(--primary)',
                              animation: 'epod-stage-spinner 1.2s linear infinite',
                            }} />
                          </>
                        ) : (
                          /* Future: outlined circle with number */
                          <div style={{
                            width: rem14(24), height: rem14(24), borderRadius: '50%',
                            backgroundColor: 'transparent',
                            border: '2px solid var(--border-primary)',
                            display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Typography variant="label-medium" style={{ color: 'var(--text-tertiary)', fontSize: rem14(10) }}>
                              {index + 1}
                            </Typography>
                          </div>
                        )}
                      </div>

                      {/* Label */}
                      <Typography
                        variant={isActive ? 'body-primary-medium' : 'body-primary-regular'}
                        style={{ color: isFuture ? 'var(--border-primary)' : 'var(--primary)' }}
                      >
                        {label}
                      </Typography>
                    </div>

                    {/* Vertical connector */}
                    {!isLast ? (
                      <div style={{ width: rem14(32), display: 'flex', justifyContent: 'center', height: rem14(24) }}>
                        {isComplete ? (
                          /* Solid line for completed-to-next */
                          <div style={{ width: rem14(2), height: '100%', backgroundColor: 'var(--primary)' }} />
                        ) : (
                          /* Dotted line for active/future */
                          <div style={{
                            width: 0, height: '100%',
                            borderLeft: '2px dotted var(--border-primary)',
                          }} />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
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
