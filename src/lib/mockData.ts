// Mock data for OCR Config Studio

export const modules = [
  { id: "epod", name: "ePOD (PTL POD)" },
  { id: "pod-recon", name: "POD Reconciliation" },
  { id: "lr", name: "LR" },
  { id: "invoice", name: "Freight Invoice" },
];

export const consignors = [
  { id: "acme", name: "ACME Pharma", moduleId: "epod" },
  { id: "globex", name: "Globex Consumer", moduleId: "epod" },
  { id: "initech", name: "Initech Retail", moduleId: "pod-recon" },
  { id: "umbrella", name: "Umbrella Distributors", moduleId: "pod-recon" },
];

export const transporters = [
  { id: "bluedart", name: "BlueDart Express", consignorId: "acme" },
  { id: "delhivery", name: "Delhivery PTL", consignorId: "acme" },
  { id: "shadowfax", name: "Shadowfax Surface", consignorId: "globex" },
  { id: "xpressbees", name: "XpressBees PTL", consignorId: "initech" },
  { id: "gati", name: "Gati PTL", consignorId: "umbrella" },
];

export const standardFields = [
  { id: "awb_number", name: "AWB Number", type: "string", mandatory: true },
  { id: "consignee_name", name: "Consignee Name", type: "string", mandatory: true },
  { id: "delivery_date", name: "Delivery Date", type: "date", mandatory: true },
  { id: "line_item_description", name: "Line Item Description", type: "string", mandatory: false },
  { id: "sent_quantity", name: "Sent Quantity", type: "number", mandatory: true },
  { id: "received_quantity", name: "Received Quantity", type: "number", mandatory: true },
  { id: "damaged_quantity", name: "Damaged Quantity", type: "number", mandatory: false },
  { id: "remarks", name: "Remarks", type: "string", mandatory: false },
  { id: "stamp_present", name: "Consignee Stamp Present", type: "boolean", mandatory: false },
  { id: "transporter_name", name: "Transporter Name", type: "string", mandatory: false },
  { id: "pod_confidence", name: "OCR Confidence", type: "number", mandatory: false },
];

export const sampleOcrOutput = {
  document: {
    type: "PTL POD",
    awb_number: "AWB-PTL-240315-0192",
    uploaded_at: "2024-03-15T10:45:00Z",
    source: "Transporter",
  },
  shipment: {
    consignor: "ACME Pharma",
    consignee_name: "MDC Labs, Amritsar",
    transporter_name: "BlueDart Express",
    delivery_date: "2024-03-15",
    stamp_present: true,
    pod_confidence: 0.93,
  },
  line_items: [
    {
      sku: "PTL-SKU-001",
      description: "Carton 1 - Diagnostic Kits",
      sent_quantity: 12,
      received_quantity: 12,
      damaged_quantity: 0,
    },
    {
      sku: "PTL-SKU-002",
      description: "Carton 2 - Cold Chain Vials",
      sent_quantity: 8,
      received_quantity: 7,
      damaged_quantity: 1,
    },
  ],
  remarks: {
    delivery_note: "1 carton wet and seal partially broken",
    exception_keywords: ["damaged", "short"],
  },
};

// Extract all JSON paths from sample output for suggestions
export const extractJsonPaths = (obj: Record<string, unknown>, prefix = "$"): string[] => {
  const paths: string[] = [];
  for (const key in obj) {
    const path = `${prefix}.${key}`;
    const value = obj[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      paths.push(...extractJsonPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
};

export const jsonPathSuggestions = extractJsonPaths(sampleOcrOutput);

// Configs with updatedBy field for the Config List
export interface Config {
  id: string;
  moduleId: string;
  consignorId: string | null;
  transporterId: string | null;
  prompt: string;
  mappings: Record<string, { jsonPath: string; mandatory: boolean }>;
  updatedAt: string;
  updatedBy: string;
  hasCustomPrompt: boolean;
}

export const configs: Config[] = [
  {
    id: "config-1",
    moduleId: "epod",
    consignorId: "acme",
    transporterId: null,
    prompt: "Extract PTL POD details for ACME Pharma. Capture AWB number, consignee name, delivery date, line-item sent vs received quantities, remarks, and consignee stamp presence.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
      consignee_name: { jsonPath: "$.shipment.consignee_name", mandatory: true },
      delivery_date: { jsonPath: "$.shipment.delivery_date", mandatory: true },
      sent_quantity: { jsonPath: "$.line_items[0].sent_quantity", mandatory: true },
      received_quantity: { jsonPath: "$.line_items[0].received_quantity", mandatory: true },
      stamp_present: { jsonPath: "$.shipment.stamp_present", mandatory: false },
    },
    updatedAt: "2024-03-15",
    updatedBy: "admin@company.com",
    hasCustomPrompt: true,
  },
  {
    id: "config-2",
    moduleId: "epod",
    consignorId: "acme",
    transporterId: "bluedart",
    prompt: "Extract BlueDart PTL PODs with focus on AWB match, consignee stamp, damage remarks, and line-item shortages.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
      transporter_name: { jsonPath: "$.shipment.transporter_name", mandatory: false },
      remarks: { jsonPath: "$.remarks.delivery_note", mandatory: false },
      pod_confidence: { jsonPath: "$.shipment.pod_confidence", mandatory: false },
    },
    updatedAt: "2024-03-14",
    updatedBy: "operator@company.com",
    hasCustomPrompt: true,
  },
  {
    id: "config-3",
    moduleId: "epod",
    consignorId: "globex",
    transporterId: null,
    prompt: "Extract Globex PTL POD information and identify unmatched, duplicate, or damaged PODs for manual review.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
      consignee_name: { jsonPath: "$.shipment.consignee_name", mandatory: true },
      damaged_quantity: { jsonPath: "$.line_items[1].damaged_quantity", mandatory: false },
    },
    updatedAt: "2024-03-12",
    updatedBy: "admin@company.com",
    hasCustomPrompt: true,
  },
  {
    id: "config-4",
    moduleId: "pod-recon",
    consignorId: "initech",
    transporterId: null,
    prompt: "Extract POD reconciliation fields for PTL approvals, including AWB, quantities, exceptions, and remarks.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
      remarks: { jsonPath: "$.remarks.delivery_note", mandatory: false },
    },
    updatedAt: "2024-03-10",
    updatedBy: "manager@company.com",
    hasCustomPrompt: true,
  },
  {
    id: "config-5",
    moduleId: "pod-recon",
    consignorId: "initech",
    transporterId: "xpressbees",
    prompt: "Default PTL reconciliation prompt for XpressBees POD review.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
    },
    updatedAt: "2024-03-08",
    updatedBy: "operator@company.com",
    hasCustomPrompt: false,
  },
  {
    id: "config-6",
    moduleId: "pod-recon",
    consignorId: "umbrella",
    transporterId: null,
    prompt: "Extract PTL POD review data for approval workflow, including exception tags for short delivery and stamp mismatch.",
    mappings: {
      awb_number: { jsonPath: "$.document.awb_number", mandatory: true },
      consignee_name: { jsonPath: "$.shipment.consignee_name", mandatory: true },
      delivery_date: { jsonPath: "$.shipment.delivery_date", mandatory: true },
      stamp_present: { jsonPath: "$.shipment.stamp_present", mandatory: false },
    },
    updatedAt: "2024-03-05",
    updatedBy: "admin@company.com",
    hasCustomPrompt: true,
  },
];

export const defaultPrompt = `Extract the following information from the document:
- AWB number
- Consignee name
- Delivery date
- Line item description
- Sent quantity vs received quantity
- Damaged quantity or shortage remarks
- Consignee stamp presence
- Any exception keywords such as damaged, broken, leakage, short

Return the data in structured JSON format.`;
