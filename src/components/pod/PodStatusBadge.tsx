import { Badge } from 'ft-design-system';

const statusVariantMap: Record<string, 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'neutral'> = {
    UPLOADED: 'neutral',
    PROCESSING: 'primary',
    PROCESSED: 'primary',
    REVIEW: 'warning',
    SUBMITTED: 'primary',
    APPROVED: 'success',
    REJECTED: 'danger',
};

export function PodStatusBadge({ status }: { status: string }) {
    const variant = statusVariantMap[status] || 'neutral';
    return <Badge variant={variant} size="sm">{status}</Badge>;
}
