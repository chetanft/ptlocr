import { useState } from "react";
import {
  Button,
  Input,
  InputField,
  InputLabel,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Typography,
  SegmentedTabs,
  SegmentedTabItem,
} from "ft-design-system";
import { modules, consignors, transporters } from "@/lib/mockData";
import { rem14 } from "@/lib/rem";

interface FilterBarProps {
  moduleId: string;
  consignorId: string;
  transporterId: string;
  onModuleChange: (value: string) => void;
  onConsignorChange: (value: string) => void;
  onTransporterChange: (value: string) => void;
  onLoadConfig: () => void;
  isLoading?: boolean;
  configLoaded?: boolean;
}

export function FilterBar({
  moduleId,
  consignorId,
  transporterId,
  onModuleChange,
  onConsignorChange,
  onTransporterChange,
  onLoadConfig,
  isLoading = false,
  configLoaded = false,
}: FilterBarProps) {
  const [consignorMode, setConsignorMode] = useState<string>(consignorId ? "specific" : "all");
  const [transporterMode, setTransporterMode] = useState<string>(transporterId ? "specific" : "all");

  const getContextLabel = () => {
    if (!moduleId) return null;
    const module = modules.find((m) => m.id === moduleId);
    const consignorName = consignorId
      ? (consignors.find((c) => c.id === consignorId)?.name || consignorId)
      : "All Consignors";
    const transporterName = transporterId
      ? (transporters.find((t) => t.id === transporterId)?.name || transporterId)
      : "All Transporters";
    return `${module?.name || moduleId} / ${consignorName} / ${transporterName}`;
  };

  const handleConsignorModeChange = (mode: string) => {
    setConsignorMode(mode);
    if (mode === "all") onConsignorChange("");
  };

  const handleTransporterModeChange = (mode: string) => {
    setTransporterMode(mode);
    if (mode === "all") onTransporterChange("");
  };

  const contextLabel = getContextLabel();

  return (
    <div className="rounded-md border border-border-primary bg-bg-primary p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Module Select */}
        <div className="flex flex-col gap-1">
          <Typography variant="body-secondary-medium" color="secondary">Module</Typography>
          <Select value={moduleId || "_none"} onValueChange={(v) => onModuleChange(v === "_none" ? "" : v)}>
            <SelectTrigger style={{ width: rem14(180) }}>
              <SelectValue placeholder="Select module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Consignor */}
        <div className="flex flex-col gap-1">
          <Typography variant="body-secondary-medium" color="secondary">Consignor</Typography>
          <div className="flex items-center gap-2">
            <SegmentedTabs
              value={consignorMode}
              onChange={handleConsignorModeChange}
            >
              <SegmentedTabItem value="all" label="All" />
              <SegmentedTabItem value="specific" label="Specific" />
            </SegmentedTabs>
            {consignorMode === "specific" && (
              <Input className="w-40">
                <InputField
                  value={consignorId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConsignorChange(e.target.value)}
                  placeholder="Enter ID..."
                  size="md"
                />
              </Input>
            )}
          </div>
        </div>

        {/* Transporter */}
        <div className="flex flex-col gap-1">
          <Typography variant="body-secondary-medium" color="secondary">Transporter</Typography>
          <div className="flex items-center gap-2">
            <SegmentedTabs
              value={transporterMode}
              onChange={handleTransporterModeChange}
            >
              <SegmentedTabItem value="all" label="All" />
              <SegmentedTabItem value="specific" label="Specific" />
            </SegmentedTabs>
            {transporterMode === "specific" && (
              <Input className="w-40">
                <InputField
                  value={transporterId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTransporterChange(e.target.value)}
                  placeholder="Enter ID..."
                  size="md"
                />
              </Input>
            )}
          </div>
        </div>

        {/* Load Button */}
        <Button
          variant="primary"
          size="md"
          onClick={onLoadConfig}
          disabled={!moduleId || isLoading}
          loading={isLoading}
          className="ml-auto"
        >
          {configLoaded ? "Reload Config" : "Load / Create Config"}
        </Button>
      </div>

      {contextLabel && configLoaded && (
        <div className="mt-3 flex items-center gap-2">
          <Typography variant="body-secondary-regular" color="tertiary">Current Context:</Typography>
          <Typography variant="body-secondary-medium" color="primary" className="rounded-md bg-neutral-light px-2 py-1">
            {contextLabel}
          </Typography>
        </div>
      )}
    </div>
  );
}
