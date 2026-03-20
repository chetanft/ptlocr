import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button, Typography } from 'ft-design-system';

interface LineRecon {
    id: string;
    sku?: string;
    description?: string;
    sentQty: number;
    receivedQty: number;
    damagedQty: number;
    reconStatus: string;
    reviewAction?: string;
    reviewNote?: string;
}

interface ReconLineTableProps {
    lines: LineRecon[];
    onReview?: (lineId: string, action: string) => void;
    onOverride?: (line: LineRecon) => void;
    readOnly?: boolean;
}

const reconVariantMap: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
    MATCH: 'success',
    SHORT: 'danger',
    EXCESS: 'warning',
    DAMAGED: 'danger',
};

const reviewVariantMap: Record<string, 'success' | 'primary' | 'danger'> = {
    ACCEPTED: 'success',
    OVERRIDDEN: 'primary',
    REJECTED: 'danger',
};

export function ReconLineTable({ lines, onReview, onOverride, readOnly = false }: ReconLineTableProps) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Sent</TableHead>
                        <TableHead className="text-center">Received</TableHead>
                        <TableHead className="text-center">Damaged</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Review</TableHead>
                        {!readOnly && <TableHead className="text-center">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lines.map((line) => (
                        <TableRow key={line.id}>
                            <TableCell>
                                <Typography variant="body-primary-medium" color="primary">{line.description}</Typography>
                                {line.sku && <Typography variant="body-secondary-regular" color="secondary">{line.sku}</Typography>}
                            </TableCell>
                            <TableCell className="text-center">{line.sentQty}</TableCell>
                            <TableCell className="text-center">{line.receivedQty}</TableCell>
                            <TableCell className="text-center">{line.damagedQty}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant={reconVariantMap[line.reconStatus] || 'neutral'} size="sm">
                                    {line.reconStatus}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                {line.reviewAction ? (
                                    <Badge variant={reviewVariantMap[line.reviewAction] || 'neutral'} size="sm">
                                        {line.reviewAction}
                                    </Badge>
                                ) : (
                                    <Typography variant="body-secondary-regular" color="secondary">Pending</Typography>
                                )}
                            </TableCell>
                            {!readOnly && (
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Button variant="primary" size="sm" onClick={() => onReview?.(line.id, 'ACCEPTED')}>Accept</Button>
                                        <Button variant="secondary" size="sm" onClick={() => onOverride?.(line)}>Override</Button>
                                        <Button variant="destructive" size="sm" onClick={() => onReview?.(line.id, 'REJECTED')}>Reject</Button>
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                    {lines.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8">
                                <Typography variant="body-secondary-regular" color="secondary">No line items to display</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
