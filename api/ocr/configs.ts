// Vercel Serverless Function for listing OCR Configs

export const config = {
  runtime: 'edge',
};

// Sample configs for demo
const sampleConfigs = [
  {
    id: 'config-1',
    moduleCode: 'trips',
    consignorCode: 'acme',
    transporterCode: null,
    prompt: 'Extract trip details including pickup, delivery, and cargo information.',
    fieldMappings: JSON.stringify({
      shipment_id: { jsonPath: '$.document.shipment_number', mandatory: true },
      sender_name: { jsonPath: '$.sender.name', mandatory: true },
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin@company.com',
    isActive: true
  },
  {
    id: 'config-2',
    moduleCode: 'freight-invoice',
    consignorCode: 'globex',
    transporterCode: null,
    prompt: 'Extract freight invoice details with line items and totals.',
    fieldMappings: JSON.stringify({
      shipment_id: { jsonPath: '$.invoice.number', mandatory: true },
      sender_name: { jsonPath: '$.vendor.name', mandatory: true },
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: 'ops@company.com',
    isActive: true
  }
];

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const module = url.searchParams.get('module');
  const consignor = url.searchParams.get('consignor');
  const transporter = url.searchParams.get('transporter');

  let filteredConfigs = [...sampleConfigs];

  if (module) {
    filteredConfigs = filteredConfigs.filter(c => c.moduleCode === module);
  }
  if (consignor) {
    filteredConfigs = filteredConfigs.filter(c => c.consignorCode === consignor);
  }
  if (transporter) {
    filteredConfigs = filteredConfigs.filter(c => c.transporterCode === transporter);
  }

  return new Response(JSON.stringify(filteredConfigs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

