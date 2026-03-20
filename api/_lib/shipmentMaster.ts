import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ShipmentRecord {
  awbNumber: string;
  shipmentId: string;
  transporter: string;
  fileName: string;
  origin: string | null;
  originCity: string | null;
  consigneeName: string | null;
  destination: string | null;
  deliveredDate: string | null;
  packageCount: number | null;
}

// Keep lookup simple for serverless: Vercel includes src/data via vercel.json includeFiles.
const CANDIDATE_PATHS = [
  join(process.cwd(), 'src/data/epodExtractedShipments.json'),
  join(process.cwd(), 'src', 'data', 'epodExtractedShipments.json'),
];

let shipments: ShipmentRecord[] = [];

for (const candidatePath of CANDIDATE_PATHS) {
  try {
    if (existsSync(candidatePath)) {
      shipments = JSON.parse(readFileSync(candidatePath, 'utf8'));
      console.log(`Loaded ${shipments.length} shipments from: ${candidatePath}`);
      break;
    }
  } catch {
    // Try next path
  }
}

if (shipments.length === 0) {
  console.warn('Could not load shipment master JSON from any path');
}

// Build lookup map
const awbMap = new Map<string, ShipmentRecord>();
for (const s of shipments) {
  awbMap.set(normalizeAwb(s.awbNumber), s);
}

export function normalizeAwb(awb: string): string {
  return awb.replace(/[\s\-_.]/g, '').toUpperCase();
}

export function findShipmentByAwb(awb: string): ShipmentRecord | null {
  return awbMap.get(normalizeAwb(awb)) ?? null;
}

export function findShipmentByFileName(fileName: string): ShipmentRecord | null {
  const clean = fileName.replace(/\.[^.]+$/, '');
  const byAwb = findShipmentByAwb(clean);
  if (byAwb) return byAwb;
  return shipments.find(s => s.fileName === fileName) ?? null;
}

export function getAllShipments(): ShipmentRecord[] {
  return shipments;
}
