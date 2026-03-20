import { Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

export function EpodProgressStepper({ steps, currentStep }: { steps: readonly string[]; currentStep: number }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: rem14(16) }}
    >
      {steps.map((step, index) => {
        const isActive = index <= currentStep;
        return (
          <div key={step} className="flex flex-col" style={{ gap: rem14(8) }}>
            <div
              style={{
                height: rem14(8),
                borderRadius: rem14(999),
                backgroundColor: isActive ? 'var(--tertiary)' : 'var(--bg-secondary)',
              }}
            />
            <Typography
              variant="body-primary-semibold"
              style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              {step}
            </Typography>
          </div>
        );
      })}
    </div>
  );
}
