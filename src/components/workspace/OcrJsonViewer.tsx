import { useState } from "react";
import { Button, Typography, Icon } from "ft-design-system";
import { cn } from "@/lib/utils";
import { rem14 } from "@/lib/rem";

interface OcrJsonViewerProps {
  data: Record<string, unknown> | null;
}

export function OcrJsonViewer({ data }: OcrJsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (data) {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border-primary bg-bg-secondary/30 p-6 text-center">
        <Typography className="text-sm text-primary-300">
          Upload a document and run OCR to see the output here
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Typography className="text-sm font-medium text-primary-700">OCR JSON Output</Typography>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="h-7 px-2"
            onClick={handleCopy}
            icon={copied ? "check" : "copy"}
          />
          <Button
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? "chevron-up" : "chevron-down"}
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border border-border-primary bg-bg-secondary/30 transition-all",
        )}
        style={{ height: isExpanded ? rem14(300) : rem14(60) }}
      >
        <div className="overflow-auto h-full w-full rounded-lg" style={{ maxHeight: rem14(500) }}>
          <pre className="p-4 text-xs text-primary-700">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
