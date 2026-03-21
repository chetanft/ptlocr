import { Button, Typography } from 'ft-design-system';
import { useAuth } from '@/auth/AuthContext';
import { rem14 } from '@/lib/rem';

interface EpodTableToolbarProps {
  selectedCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onUpload: () => void;
}

export function EpodTableToolbar({
  selectedCount,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  onUpload,
}: EpodTableToolbarProps) {
  const { user } = useAuth();
  const isTransporter = user?.role === 'Transporter';
  const isOps = user?.role === 'Ops';

  return (
    <div className="flex items-center justify-between gap-4">
      <Typography variant="body-secondary-semibold" color="primary">
        {selectedCount > 0 ? `${String(selectedCount).padStart(2, '0')} AWBs selected` : `${totalCount} AWBs available`}
      </Typography>
      <div className="flex items-center gap-[1.125rem]">
        {selectedCount > 0 ? (
          <Button variant="secondary" icon="download" size="md">
            Download AWBs
          </Button>
        ) : (
          <Button variant="text" icon="download" iconPosition="only" size="md" aria-label="Download AWBs" />
        )}
        <Button variant="text" icon="filter" iconPosition="only" size="md" aria-label="Filter" />
        {isOps ? (
          <Button
            variant="text"
            icon="file-upload"
            iconPosition="only"
            size="sm"
            aria-label="Upload ePOD images"
            onClick={onUpload}
          />
        ) : null}
        <div className="flex items-center gap-2">
          {isTransporter ? (
            <Button
              variant="secondary"
              icon="file-upload"
              size="md"
              onClick={onUpload}
              disabled={selectedCount === 0}
            >
              Upload ePOD images
            </Button>
          ) : null}
          <Button
            variant="text"
            icon="chevron-left"
            iconPosition="only"
            size="sm"
            aria-label="Previous page"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          />
          <div
            className="flex items-center justify-center border border-border-primary rounded-md"
            style={{ width: rem14(54), minHeight: rem14(40) }}
          >
            <Typography variant="body-secondary-regular" color="tertiary">{currentPage}</Typography>
          </div>
          <Button
            variant="text"
            icon="chevron-right"
            iconPosition="only"
            size="sm"
            aria-label="Next page"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          />
        </div>
      </div>
    </div>
  );
}
