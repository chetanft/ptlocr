import type { ChangeEvent, DragEvent } from 'react';

import { Button, Icon, Typography } from 'ft-design-system';

import { rem14 } from '@/lib/rem';

export function EpodUploadDropzone({
  onFileSelect,
}: {
  onFileSelect: (files: FileList) => void;
}) {
  const inputId = 'epod-upload-file-input';

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      onFileSelect(event.target.files);
    }
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      onFileSelect(event.dataTransfer.files);
    }
  };

  return (
    <div
      onClick={() => document.getElementById(inputId)?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-primary bg-bg-secondary text-center"
      style={{ gap: rem14(20), padding: rem14(24), height: '100%' }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          document.getElementById(inputId)?.click();
        }
      }}
    >
      <div
        className="flex items-center justify-center rounded-md bg-white"
        style={{ width: rem14(48), height: rem14(48) }}
      >
        <Icon name="file-upload" size="lg" className="text-primary-500" />
      </div>
      <Typography variant="body-primary-semibold" color="primary">
        Click or Drag and drop file here to upload or{' '}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            document.getElementById(inputId)?.click();
          }}
          style={{ display: 'inline-flex', padding: 0, height: 'auto', minWidth: 0, verticalAlign: 'baseline' }}
        >
          Choose files
        </Button>
      </Typography>
      <Typography variant="body-secondary" color="secondary">
        Allowed file type: image/* &amp; .pdf | Max Size: 10 mb
      </Typography>
      <input
        id={inputId}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
