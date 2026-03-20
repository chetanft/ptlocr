import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Typography,
} from 'ft-design-system';

export interface EpodImagePreview {
  fileName: string;
  previewUrl: string;
}

interface EpodImagePreviewModalProps {
  open: boolean;
  preview: EpodImagePreview | null;
  onOpenChange: (open: boolean) => void;
}

export function EpodImagePreviewModal({
  open,
  preview,
  onOpenChange,
}: EpodImagePreviewModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-5xl">
        <ModalHeader>
          <ModalTitle>{preview?.fileName ?? 'Image preview'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            {preview?.previewUrl ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border-primary bg-[var(--bg-secondary)] p-4">
                <img
                  src={preview.previewUrl}
                  alt={preview.fileName}
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border-primary bg-[var(--bg-secondary)] px-6 py-10">
                <Typography variant="body-primary-regular" color="secondary">
                  No image preview available for this file.
                </Typography>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
