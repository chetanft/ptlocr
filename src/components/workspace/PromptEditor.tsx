import {
  Textarea,
  TextareaField,
  TextareaLabel,
  Badge,
  Typography,
} from "ft-design-system";
import { rem14 } from "@/lib/rem";

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  isDefault: boolean;
}

export function PromptEditor({ prompt, onPromptChange, isDefault }: PromptEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Typography className="text-sm font-medium text-primary-700">OCR Prompt</Typography>
        {isDefault && (
          <Badge variant="secondary" className="text-xs">
            Default prompt loaded
          </Badge>
        )}
      </div>

      <Textarea>
        <TextareaLabel>OCR Prompt</TextareaLabel>
        <TextareaField
          value={prompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPromptChange(e.target.value)}
          placeholder="Enter your OCR extraction prompt..."
          className="resize-none bg-bg-secondary font-mono text-sm"
          style={{ minHeight: rem14(180) }}
        />
      </Textarea>

      <Typography className="text-xs text-primary-300">
        Editing this prompt will override defaults for this filter combination.
      </Typography>
    </div>
  );
}
