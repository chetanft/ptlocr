import { Icon, Typography } from 'ft-design-system';
import { rem } from '@/lib/rem';

const STEPS = [
  'Running OCR extraction',
  'Matching with load data',
  'Validating information',
  'Finalising results',
];

interface EpodProcessingTimelineProps {
  activeStep?: number;
  batch?: { status?: string; totalFiles?: number; processedFiles?: number } | null;
}

function deriveStep(batch?: EpodProcessingTimelineProps['batch']): number {
  if (!batch || !batch.totalFiles) return 0;
  if (batch.status === 'REVIEW_REQUIRED' || batch.status === 'READY_TO_SUBMIT' || batch.status === 'SUBMITTED') return 3;
  const ratio = Math.min((batch.processedFiles ?? 0) / batch.totalFiles, 1);
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.5) return 2;
  if (ratio >= 0.25) return 1;
  return 0;
}

/** CSS spinner keyframes injected once */
const spinnerStyle = `
@keyframes epod-spinner {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

export function EpodProcessingTimeline({ activeStep, batch }: EpodProcessingTimelineProps) {
  const currentStep = activeStep ?? deriveStep(batch);

  return (
    <>
      <style>{spinnerStyle}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `${rem(32)} 0` }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: rem(280) }}>
          {STEPS.map((label, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isFuture = index > currentStep;
            const isLast = index === STEPS.length - 1;

            return (
              <div key={label}>
                {/* Step row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: rem(16) }}>
                  {/* Circle */}
                  <div style={{ width: rem(32), height: rem(32), position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isCompleted ? (
                      /* Completed: dark circle with checkmark */
                      <div style={{
                        width: rem(24), height: rem(24), borderRadius: '50%',
                        backgroundColor: 'var(--primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name="check" size={10} style={{ color: '#fff' }} />
                      </div>
                    ) : isActive ? (
                      /* Active: dark circle with spinning arc */
                      <>
                        <div style={{
                          width: rem(24), height: rem(24), borderRadius: '50%',
                          backgroundColor: 'var(--primary)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          position: 'relative', zIndex: 1,
                        }}>
                          <Icon name="check" size={10} style={{ color: '#fff' }} />
                        </div>
                        {/* Spinner arc */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          width: rem(32), height: rem(32),
                          borderRadius: '50%',
                          border: '2.5px solid transparent',
                          borderTopColor: 'var(--primary)',
                          borderRightColor: 'var(--primary)',
                          animation: 'epod-spinner 1.2s linear infinite',
                        }} />
                      </>
                    ) : (
                      /* Future: gray circle with number */
                      <div style={{
                        width: rem(24), height: rem(24), borderRadius: '50%',
                        backgroundColor: 'var(--border-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: 'var(--primary)', fontSize: rem(10), fontWeight: 500 }}>
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <Typography
                    variant="body-primary-regular"
                    style={{ color: isFuture ? 'var(--border-primary)' : 'var(--primary)' }}
                  >
                    {label}
                  </Typography>
                </div>

                {/* Vertical connector */}
                {!isLast ? (
                  <div style={{ width: rem(32), display: 'flex', justifyContent: 'center', height: rem(24) }}>
                    {isCompleted ? (
                      /* Solid line for completed */
                      <div style={{ width: rem(2), height: '100%', backgroundColor: 'var(--primary)' }} />
                    ) : (
                      /* Dashed line for pending */
                      <div style={{
                        width: 0, height: '100%',
                        borderLeft: '2px dashed var(--border-primary)',
                      }} />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
