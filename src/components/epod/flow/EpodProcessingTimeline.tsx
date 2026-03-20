import { Typography } from 'ft-design-system';
import { EPOD_PROCESSING_STEPS } from '@/lib/epod/status';
import type { EpodBatchJob } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

function getActiveIndex(batch?: EpodBatchJob | null) {
  if (!batch || batch.totalFiles === 0) return 0;
  if (batch.status === 'REVIEW_REQUIRED' || batch.status === 'READY_TO_SUBMIT' || batch.status === 'SUBMITTED') {
    return 3;
  }

  const processedRatio = Math.min(batch.processedFiles / batch.totalFiles, 1);

  if (processedRatio >= 0.75) return 3;
  if (processedRatio >= 0.5) return 2;
  if (processedRatio >= 0.25) return 1;
  return 0;
}

export function EpodProcessingTimeline({ batch }: { batch?: EpodBatchJob | null }) {
  const activeIndex = getActiveIndex(batch);
  const isProcessing =
    !!batch &&
    (batch.status === 'OCR_PROCESSING' || batch.status === 'MATCHING') &&
    batch.processedFiles < batch.totalFiles;

  return (
    <div className="flex flex-col items-center" style={{ paddingTop: rem14(24), paddingBottom: rem14(24) }}>
      <div className="flex flex-col" style={{ gap: 0 }}>
        {EPOD_PROCESSING_STEPS.map((step, index) => {
          const isActive = index <= activeIndex;
          const isLast = index === EPOD_PROCESSING_STEPS.length - 1;
          const isCurrent = isProcessing && index === activeIndex;

          return (
            <div key={step} className="flex flex-col items-start">
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center rounded-full shrink-0 ${isCurrent ? 'animate-pulse' : ''}`}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: isActive ? 'var(--primary-700)' : 'var(--border-primary)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </div>
                <Typography variant="body-primary-regular" style={{ color: isActive ? 'var(--primary)' : 'var(--border-primary)' }}>
                  {step}
                </Typography>
              </div>
              {!isLast ? (
                <div style={{ width: 24, display: 'flex', justifyContent: 'center', height: 32 }}>
                  <div style={{ width: 0, height: '100%', borderLeft: `2px dashed ${index < activeIndex ? 'var(--primary-700)' : 'var(--border-primary)'}` }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
