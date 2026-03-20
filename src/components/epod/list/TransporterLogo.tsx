import { Logo, Typography } from 'ft-design-system';

const LOGO_NAME_MAP: Record<string, string> = {
  MEC: 'mec',
  'Om Logistics': 'om-logistics',
  Safexpress: 'safexpress',
};

interface TransporterLogoProps {
  name: string;
  showName?: boolean;
}

export function TransporterLogo({ name, showName = false }: TransporterLogoProps) {
  const logoName = LOGO_NAME_MAP[name];

  if (logoName) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo name={logoName} height={20} />
        {showName ? (
          <Typography variant="body-secondary-regular" color="secondary">{name}</Typography>
        ) : null}
      </div>
    );
  }

  return <Typography variant="body-secondary-regular" color="primary">{name}</Typography>;
}
