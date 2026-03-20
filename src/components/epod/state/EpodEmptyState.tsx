import { Alert, AlertDescription, Card, CardBody, Typography } from 'ft-design-system';

export function EpodEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card bordered>
      <CardBody>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Typography variant="display-primary" color="primary">{title}</Typography>
          <Alert variant="warning">
            <AlertDescription>{description}</AlertDescription>
          </Alert>
        </div>
      </CardBody>
    </Card>
  );
}
