import type { EpodUploadFile } from '@/lib/epod/types';
import { EpodUploadedFileCard } from './EpodUploadedFileCard';

export function EpodUploadedFileList({
  files,
  onRemove,
}: {
  files: EpodUploadFile[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {files.map((file) => (
        <EpodUploadedFileCard key={file.id} file={file} onRemove={onRemove} />
      ))}
    </div>
  );
}
