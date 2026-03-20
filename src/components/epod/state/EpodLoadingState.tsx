import { Card, CardBody, Loader, Typography } from 'ft-design-system';

export function EpodLoadingState({ label }: { label: string }) {
  return (
    <Card bordered>
      <CardBody>
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader />
          <Typography variant="body-primary-regular" color="tertiary">{label}</Typography>
        </div>
      </CardBody>
    </Card>
  );
}
