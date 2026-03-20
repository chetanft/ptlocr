import { Badge } from "ft-design-system";

type StatusType = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
}

const statusVariantMap: Record<StatusType, string> = {
  success: "success",
  warning: "warning",
  error: "danger",
  info: "neutral",
  default: "secondary",
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} className={className}>
      {children}
    </Badge>
  );
}
