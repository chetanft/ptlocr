import { MECLogo, OMLogisticsLogo, SafexpressLogo, Typography } from 'ft-design-system';

const LOGO_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MEC: MECLogo,
  'Om Logistics': OMLogisticsLogo,
  Safexpress: SafexpressLogo,
};

interface TransporterLogoProps {
  name: string;
  showName?: boolean;
}

export function TransporterLogo({ name, showName = true }: TransporterLogoProps) {
  const LogoComponent = LOGO_MAP[name];

  if (LogoComponent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoComponent className="h-[22px] w-auto" />
        {showName ? (
          <Typography variant="body-secondary-regular" color="secondary">
            {name}
          </Typography>
        ) : null}
      </div>
    );
  }

  // Fallback: just text for unknown transporters
  return (
    <Typography variant="body-secondary-regular" color="primary">
      {name}
    </Typography>
  );
}
