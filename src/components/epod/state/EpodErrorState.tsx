import { Alert, AlertDescription, AlertTitle } from 'ft-design-system';

export function EpodErrorState({ message }: { message: string }) {
  return (
    <Alert variant="danger">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
