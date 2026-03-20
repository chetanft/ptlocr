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
import type { EpodBatchJob } from '@/lib/epod/types';

interface EpodCancelBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: EpodBatchJob | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function EpodCancelBatchModal({
  open,
  onOpenChange,
  batch,
  onConfirm,
  loading,
}: EpodCancelBatchModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Cancel batch job</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <Typography variant="body-primary-regular" color="primary">
              Completed items stay available, but remaining files will stop processing.
            </Typography>
            {batch ? (
              <div className="grid grid-cols-3 gap-3">
                <div><Typography variant="body-secondary-regular" color="tertiary">Total</Typography><Typography variant="display-primary">{batch.totalFiles}</Typography></div>
                <div><Typography variant="body-secondary-regular" color="tertiary">Processed</Typography><Typography variant="display-primary">{batch.processedFiles}</Typography></div>
                <div><Typography variant="body-secondary-regular" color="tertiary">Submitted</Typography><Typography variant="display-primary">{batch.submittedCount}</Typography></div>
              </div>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>No, go back</Button>
          <Button variant="primary" onClick={onConfirm} loading={loading}>Yes, cancel job</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
