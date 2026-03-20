import { useState, useCallback } from "react";
import { Button, Typography, Icon } from "ft-design-system";
import { cn } from "@/lib/utils";
import { rem14 } from "@/lib/rem";

interface SandboxUploadProps {
  onRunOcr: (file: File) => void;
  isRunning: boolean;
  hasResult: boolean;
}

export function SandboxUpload({ onRunOcr, isRunning, hasResult }: SandboxUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.type.startsWith("image/"))) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <div className="space-y-3">
      <Typography className="text-sm font-medium text-primary-700">Sample Document Upload</Typography>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border-primary hover:border-primary/50 hover:bg-bg-secondary/50"
        )}
        style={{ minHeight: rem14(100) }}
      >
        {file ? (
          <div className="flex items-center gap-3 p-4">
            <Icon name="file-text" className="h-8 w-8 text-primary-700" />
            <div className="flex-1">
              <Typography className="text-sm font-medium text-primary-700">{file.name}</Typography>
              <Typography className="text-xs text-primary-300">
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            </div>
            <Button
              variant="ghost"
              icon="x"
              className="h-6 w-6"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                removeFile();
              }}
            />
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 p-4">
            <Icon name="file-upload" className="h-8 w-8 text-primary-300" />
            <Typography className="text-sm text-primary-300">
              Drop PDF or image here, or click to browse
            </Typography>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      <Button
        onClick={() => file && onRunOcr(file)}
        disabled={!file || isRunning}
        className="w-full"
        variant={hasResult ? "outline" : "primary"}
        loading={isRunning}
        icon={!isRunning ? "upload" : undefined}
      >
        {isRunning
          ? "Running OCR..."
          : hasResult
            ? "Re-run OCR Test"
            : "Run OCR Test"}
      </Button>
    </div>
  );
}
