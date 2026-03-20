import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Typography,
} from "ft-design-system";
import { modules, consignors, transporters } from "@/lib/mockData";

interface HierarchySelectorProps {
  onSelectionChange?: (selection: {
    moduleId: string | null;
    consignorId: string | null;
    transporterId: string | null;
  }) => void;
  showLabels?: boolean;
  compact?: boolean;
}

export function HierarchySelector({
  onSelectionChange,
  showLabels = true,
  compact = false
}: HierarchySelectorProps) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedConsignor, setSelectedConsignor] = useState<string | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<string | null>(null);

  const filteredConsignors = consignors.filter(
    (c) => !selectedModule || c.moduleId === selectedModule
  );

  const filteredTransporters = transporters.filter(
    (t) => !selectedConsignor || t.consignorId === selectedConsignor
  );

  useEffect(() => {
    onSelectionChange?.({
      moduleId: selectedModule,
      consignorId: selectedConsignor,
      transporterId: selectedTransporter,
    });
  }, [selectedModule, selectedConsignor, selectedTransporter, onSelectionChange]);

  const handleModuleChange = (value: string) => {
    const newValue = value === "all" ? null : value;
    setSelectedModule(newValue);
    setSelectedConsignor(null);
    setSelectedTransporter(null);
  };

  const handleConsignorChange = (value: string) => {
    const newValue = value === "all" ? null : value;
    setSelectedConsignor(newValue);
    setSelectedTransporter(null);
  };

  const handleTransporterChange = (value: string) => {
    const newValue = value === "all" ? null : value;
    setSelectedTransporter(newValue);
  };

  return (
    <div className={`grid gap-4 ${compact ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3"}`}>
      <div className="space-y-2">
        {showLabels && <Typography variant="body-secondary-medium" color="primary">Module</Typography>}
        <Select value={selectedModule || "all"} onValueChange={handleModuleChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module.id} value={module.id}>
                {module.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {showLabels && <Typography variant="body-secondary-medium" color="primary">Consignor</Typography>}
        <Select
          value={selectedConsignor || "all"}
          onValueChange={handleConsignorChange}
          disabled={!selectedModule}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Consignor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Consignors</SelectItem>
            {filteredConsignors.map((consignor) => (
              <SelectItem key={consignor.id} value={consignor.id}>
                {consignor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {showLabels && <Typography variant="body-secondary-medium" color="primary">Transporter</Typography>}
        <Select
          value={selectedTransporter || "all"}
          onValueChange={handleTransporterChange}
          disabled={!selectedConsignor}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Transporter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transporters</SelectItem>
            {filteredTransporters.map((transporter) => (
              <SelectItem key={transporter.id} value={transporter.id}>
                {transporter.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
