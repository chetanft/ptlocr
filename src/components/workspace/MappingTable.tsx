import {
  Switch,
  SwitchInput,
  Badge,
  Input,
  InputField,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Typography,
} from "ft-design-system";
import { standardFields, jsonPathSuggestions } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { rem14 } from "@/lib/rem";

export interface FieldMapping {
  jsonPath: string;
  mandatory: boolean;
}

interface MappingTableProps {
  mappings: Record<string, FieldMapping>;
  onMappingChange: (fieldId: string, updates: Partial<FieldMapping>) => void;
  hasOcrOutput: boolean;
}

export function MappingTable({ mappings, onMappingChange, hasOcrOutput }: MappingTableProps) {
  const getFieldStatus = (fieldId: string) => {
    const mapping = mappings[fieldId];
    const field = standardFields.find((f) => f.id === fieldId);
    const isMandatory = mapping?.mandatory ?? field?.mandatory ?? false;
    const hasMapping = mapping?.jsonPath && mapping.jsonPath.length > 0;

    if (isMandatory && !hasMapping) return "error";
    if (!hasMapping) return "unmapped";
    return "mapped";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "mapped":
        return <Badge className="bg-positive/10 text-positive hover:bg-positive/20">Mapped</Badge>;
      case "unmapped":
        return <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">Unmapped</Badge>;
      case "error":
        return <Badge variant="destructive" className="bg-critical/10 text-critical hover:bg-critical/20">Required</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-bg-secondary/50">
            <TableHead style={{ width: rem14(180) }}>
              <Typography>Field Name</Typography>
            </TableHead>
            <TableHead style={{ width: rem14(80) }}>
              <Typography>Type</Typography>
            </TableHead>
            <TableHead>
              <Typography>JSON Path / Source</Typography>
            </TableHead>
            <TableHead className="text-center" style={{ width: rem14(90) }}>
              <Typography>Mandatory</Typography>
            </TableHead>
            <TableHead className="text-center" style={{ width: rem14(90) }}>
              <Typography>Status</Typography>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standardFields.map((field) => {
            const mapping = mappings[field.id] || { jsonPath: "", mandatory: field.mandatory };
            const status = getFieldStatus(field.id);

            return (
              <TableRow
                key={field.id}
                className={cn(
                  status === "error" && "bg-critical/5"
                )}
              >
                <TableCell className="font-medium">
                  <Typography>{field.name}</Typography>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">
                    {field.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {hasOcrOutput ? (
                    <Select
                      value={mapping.jsonPath || "none"}
                      onValueChange={(value) =>
                        onMappingChange(field.id, { jsonPath: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-8 bg-bg-secondary text-xs">
                        <SelectValue placeholder="Select JSON path" />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-primary">
                        <SelectItem value="none">-- Not mapped --</SelectItem>
                        {jsonPathSuggestions.map((path) => (
                          <SelectItem key={path} value={path} className="text-xs">
                            {path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input>
                      <InputField
                        value={mapping.jsonPath}
                        onChange={(e) =>
                          onMappingChange(field.id, { jsonPath: e.target.value })
                        }
                        placeholder="$.path.to.field"
                        className="h-8 bg-bg-secondary text-xs"
                      />
                    </Input>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch>
                    <SwitchInput
                      checked={mapping.mandatory}
                      onChange={(checked) =>
                        onMappingChange(field.id, { mandatory: checked })
                      }
                    />
                  </Switch>
                </TableCell>
                <TableCell className="text-center">
                  {statusBadge(status)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
