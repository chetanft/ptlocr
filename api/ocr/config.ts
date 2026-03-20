// Vercel Serverless Function for OCR Config Management
// Note: For production, connect to a real database (Supabase, PlanetScale, etc.)

export const config = {
  runtime: 'edge',
};

// In-memory store (for demo purposes - resets on cold start)
// For production, replace with a real database
const configs: Map<string, any> = new Map();

function getConfigKey(module: string, consignor?: string, transporter?: string): string {
  return `${module}|${consignor || ''}|${transporter || ''}`;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  
  if (req.method === 'GET') {
    // GET /api/ocr/config?module=...&consignor=...&transporter=...
    const module = url.searchParams.get('module');
    const consignor = url.searchParams.get('consignor');
    const transporter = url.searchParams.get('transporter');

    if (!module) {
      return new Response(JSON.stringify({ error: 'Module is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try to find config with fallback hierarchy
    let config = null;
    
    // Level 1: Most specific
    if (consignor && transporter) {
      config = configs.get(getConfigKey(module, consignor, transporter));
    }
    
    // Level 2: Consignor only
    if (!config && consignor) {
      config = configs.get(getConfigKey(module, consignor));
    }
    
    // Level 3: Module default
    if (!config) {
      config = configs.get(getConfigKey(module));
    }

    if (!config) {
      // Return default config structure
      config = {
        moduleCode: module,
        consignorCode: consignor,
        transporterCode: transporter,
        prompt: null,
        fieldMappings: {},
        isNew: true
      };
    }

    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } else if (req.method === 'POST') {
    // POST /api/ocr/config
    try {
      const body = await req.json();
      const { moduleCode, consignorCode, transporterCode, prompt, fieldMappings, updatedBy } = body;

      if (!moduleCode) {
        return new Response(JSON.stringify({ error: 'Module is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const key = getConfigKey(moduleCode, consignorCode, transporterCode);
      
      const configData = {
        id: key,
        moduleCode,
        consignorCode: consignorCode || null,
        transporterCode: transporterCode || null,
        prompt,
        fieldMappings: typeof fieldMappings === 'string' ? fieldMappings : JSON.stringify(fieldMappings),
        updatedBy,
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      configs.set(key, configData);

      return new Response(JSON.stringify({ success: true, config: configData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

