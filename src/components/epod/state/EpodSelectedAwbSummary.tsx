import { Badge, Card, CardBody, Typography } from 'ft-design-system';
import type { EpodSelectedShipment } from '@/lib/epod/types';

export function EpodSelectedAwbSummary({ shipments }: { shipments: EpodSelectedShipment[] }) {
  return (
    <Card bordered>
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Typography variant="display-primary" color="primary">Selected PTL AWBs</Typography>
            <Badge variant="primary">{shipments.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {shipments.map((shipment) => (
              <Badge key={shipment.awbNumber} variant="secondary">
                {shipment.awbNumber}
              </Badge>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
