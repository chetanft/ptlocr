import { Badge } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

const exceptionVariantMap: Record<string, 'danger' | 'warning' | 'neutral'> = {
    SHORT_DELIVERY: 'danger',
    DAMAGED_ITEMS: 'danger',
    STAMP_MISSING: 'warning',
    SIGNATURE_MISSING: 'warning',
    UNMATCHED_POD: 'warning',
    DUPLICATE_POD: 'neutral',
};

const severityVariantMap: Record<string, 'danger' | 'warning' | 'neutral'> = {
    LOW: 'neutral',
    MEDIUM: 'warning',
    HIGH: 'danger',
    CRITICAL: 'danger',
};

export function ExceptionBadge({ type, severity }: { type: string; severity?: string }) {
    const variant = exceptionVariantMap[type] || 'neutral';
    const label = type.replace(/_/g, ' ');
    return (
        <span className="inline-flex items-center" style={{ gap: rem14(8) }}>
            <Badge variant={variant} size="sm">{label}</Badge>
            {severity && (
                <Badge variant={severityVariantMap[severity] || 'neutral'} size="xs">{severity}</Badge>
            )}
        </span>
    );
}
