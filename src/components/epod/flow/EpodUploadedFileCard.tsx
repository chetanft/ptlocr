import { Button, Card, CardBody, Icon, ProgressBar, Typography } from 'ft-design-system';
import type { EpodUploadFile } from '@/lib/epod/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EpodUploadedFileCard({
  file,
  onRemove,
}: {
  file: EpodUploadFile;
  onRemove: (id: string) => void;
}) {
  return (
    <Card bordered size="sm">
      <CardBody>
        {file.status === 'queued' ? (
          <div className="flex items-center gap-3">
            <Icon name="file" size={24} style={{ color: 'var(--secondary)' }} />
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Typography variant="body-primary-regular" color="primary">{file.file.name}</Typography>
                <Button variant="ghost" icon="cross" iconPosition="only" size="sm" onClick={() => onRemove(file.id)} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={file.progress} size="sm" variant="primary" />
                </div>
                <Typography variant="body-secondary-regular" style={{ color: 'var(--secondary)', minWidth: 32, textAlign: 'right' }}>
                  {file.progress}%
                </Typography>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Icon name="file" size={24} style={{ color: file.status === 'error' ? 'var(--critical)' : 'var(--secondary)' }} />
            <div className="flex-1 flex flex-col gap-1">
              <Typography variant="body-primary-semibold" color="primary">{file.file.name}</Typography>
              <Typography variant="body-secondary-regular" color="tertiary">
                {formatFileSize(file.file.size)} {file.error ? `| ${file.error}` : '| Ready to process'}
              </Typography>
            </div>
            <Button variant="ghost" icon="delete" iconPosition="only" size="sm" onClick={() => onRemove(file.id)} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
