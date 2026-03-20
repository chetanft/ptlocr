import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  InputField,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownMenu,
  DropdownMenuItem,
  Typography,
  Icon,
} from "ft-design-system";
import { configs, modules, consignors, transporters } from "@/lib/mockData";
import { listStoredOcrConfigs } from "@/lib/ocrConfigStore";
import { rem14 } from "@/lib/rem";

export default function ConfigList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const storedConfigs = listStoredOcrConfigs();

  const getModuleName = (moduleId: string) =>
    modules.find((m) => m.id === moduleId)?.name || moduleId;

  const getConsignorName = (consignorId: string | null) =>
    consignorId
      ? consignors.find((c) => c.id === consignorId)?.name || consignorId
      : "—";

  const getTransporterName = (transporterId: string | null) =>
    transporterId
      ? transporters.find((t) => t.id === transporterId)?.name
      : "All";

  const configRows = storedConfigs.length > 0
    ? storedConfigs.map((config) => ({
        id: config.id,
        moduleId: config.moduleCode,
        consignorId: config.consignorCode,
        transporterId: config.transporterCode,
        hasCustomPrompt: Boolean(config.prompt),
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy ?? "browser-local",
      }))
    : configs;

  const filteredConfigs = configRows.filter((config) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const moduleName = getModuleName(config.moduleId).toLowerCase();
    const consignorName = getConsignorName(config.consignorId).toLowerCase();
    const transporterName = getTransporterName(config.transporterId)?.toLowerCase() || "";

    return (
      moduleName.includes(query) ||
      consignorName.includes(query) ||
      transporterName.includes(query)
    );
  });

  const handleEdit = (config: typeof configs[0]) => {
    const params = new URLSearchParams({
      module: config.moduleId,
      consignor: config.consignorId || "",
      ...(config.transporterId && { transporter: config.transporterId }),
    });
    navigate(`/?${params.toString()}`);
  };

  const handleDuplicate = (config: typeof configs[0]) => {
    console.log("Duplicate Config: Select a target combination for the duplicated config.");
  };

  const handleDelete = (config: typeof configs[0]) => {
    console.log("Config Deleted: The configuration has been deactivated.");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="title-secondary" color="primary">
            Active OCR Configurations
          </Typography>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input>
            <InputField
              leadingIcon="search"
              placeholder="Search by module, consignor, or transporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Input>
        </div>
        <Badge variant="neutral">
          {filteredConfigs.length} config{filteredConfigs.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="rounded-lg border border-border-primary bg-bg-primary">
        <Table>
          <TableHeader>
            <TableRow className="bg-bg-secondary">
              <TableHead>Module</TableHead>
              <TableHead>Consignor</TableHead>
              <TableHead>Transporter</TableHead>
              <TableHead className="text-center">Custom Prompt</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Updated By</TableHead>
              <TableHead style={{ width: rem14(80) }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-primary-300">
                  No configurations found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredConfigs.map((config) => (
                <TableRow key={config.id} className="group">
                  <TableCell className="font-medium">
                    {getModuleName(config.moduleId)}
                  </TableCell>
                  <TableCell>{getConsignorName(config.consignorId)}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">
                      {getTransporterName(config.transporterId)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {config.hasCustomPrompt ? (
                      <Icon name="check" size={16} style={{ color: 'var(--color-positive)' }} />
                    ) : (
                      <Icon name="close" size={16} />
                    )}
                  </TableCell>
                  <TableCell className="text-primary-300">
                    {config.updatedAt}
                  </TableCell>
                  <TableCell className="text-primary-300">
                    {config.updatedBy}
                  </TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <Icon name="more" size={16} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent align="end" className="bg-bg-primary">
                        <DropdownMenu>
                          <DropdownMenuItem onClick={() => handleEdit(config)}>
                            <Icon name="edit" size={16} />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(config)}>
                            <Icon name="copy" size={16} />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(config)}
                            className="text-critical focus:text-critical"
                          >
                            <Icon name="delete" size={16} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </DropdownContent>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
