import { MECLogo, OMLogisticsLogo, SafexpressLogo, Typography } from 'ft-design-system';

const LOGO_COMPONENT_MAP = {
  MEC: MECLogo,
  'Om Logistics': OMLogisticsLogo,
  Safexpress: SafexpressLogo,
} as const;

interface TransporterLogoProps {
  name: string;
  showName?: boolean;
}

export function TransporterLogo({ name, showName = false }: TransporterLogoProps) {
  const LogoComponent = LOGO_COMPONENT_MAP[name as keyof typeof LOGO_COMPONENT_MAP];

  if (LogoComponent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoComponent height={22} />
        {showName ? (
          <Typography variant="body-secondary-regular" color="secondary">{name}</Typography>
        ) : null}
      </div>
    );
  }

  return <Typography variant="body-secondary-regular" color="primary">{name}</Typography>;
}
