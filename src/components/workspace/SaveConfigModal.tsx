import { useState } from "react";
import {
  Button,
  Checkbox,
  CheckboxInput,
  CheckboxLabel,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Typography,
} from "ft-design-system";
import { consignors, transporters } from "@/lib/mockData";

interface SaveConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  consignorId: string;
  onApply: (targets: string[]) => void;
}

export function SaveConfigModal({
  open,
  onOpenChange,
  moduleId,
  consignorId,
  onApply,
}: SaveConfigModalProps) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const moduleConsignors = consignors.filter((c) => c.moduleId === moduleId);
  const consignorTransporters = transporters.filter((t) => t.consignorId === consignorId);

  const handleToggle = (target: string) => {
    setSelectedTargets((prev) =>
      prev.includes(target)
        ? prev.filter((t) => t !== target)
        : [...prev, target]
    );
  };

  const handleApply = () => {
    onApply(selectedTargets);
    setSelectedTargets([]);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="bg-bg-primary sm:max-w-md">
        <ModalHeader>
          <ModalTitle>
            <Typography>Copy Config to Other Combinations</Typography>
          </ModalTitle>
          <ModalDescription>
            <Typography>Select which combinations should receive this configuration.</Typography>
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Typography className="text-sm font-medium">Quick Options</Typography>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox>
                    <CheckboxInput
                      checked={selectedTargets.includes("all_transporters")}
                      onChange={() => handleToggle("all_transporters")}
                    />
                    <CheckboxLabel>
                      <Typography className="text-sm">All transporters for this consignor</Typography>
                    </CheckboxLabel>
                  </Checkbox>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox>
                    <CheckboxInput
                      checked={selectedTargets.includes("all_consignors")}
                      onChange={() => handleToggle("all_consignors")}
                    />
                    <CheckboxLabel>
                      <Typography className="text-sm">All consignors for this module</Typography>
                    </CheckboxLabel>
                  </Checkbox>
                </label>
              </div>
            </div>

            {consignorTransporters.length > 0 && (
              <div className="space-y-3">
                <Typography className="text-sm font-medium">Specific Transporters</Typography>
                <div className="max-h-32 space-y-2 overflow-y-auto">
                  {consignorTransporters.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox>
                        <CheckboxInput
                          checked={selectedTargets.includes(t.id)}
                          onChange={() => handleToggle(t.id)}
                        />
                        <CheckboxLabel>
                          <Typography className="text-sm">{t.name}</Typography>
                        </CheckboxLabel>
                      </Checkbox>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {moduleConsignors.length > 1 && (
              <div className="space-y-3">
                <Typography className="text-sm font-medium">Other Consignors</Typography>
                <div className="max-h-32 space-y-2 overflow-y-auto">
                  {moduleConsignors
                    .filter((c) => c.id !== consignorId)
                    .map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox>
                          <CheckboxInput
                            checked={selectedTargets.includes(c.id)}
                            onChange={() => handleToggle(c.id)}
                          />
                          <CheckboxLabel>
                            <Typography className="text-sm">{c.name}</Typography>
                          </CheckboxLabel>
                        </Checkbox>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedTargets.length === 0}>
            Apply to {selectedTargets.length} target{selectedTargets.length !== 1 ? "s" : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
