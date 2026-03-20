import { readFileSync } from 'fs';
import { resolve } from 'path';

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

// Load shipment master JSON at module init
let shipments: ShipmentRecord[] = [];
try {
  const dataPath = resolve(__dirname, '../../src/data/epodExtractedShipments.json');
  shipments = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch {
  console.warn('Could not load shipment master JSON, using empty array');
}

// Build lookup map with normalized AWB keys
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
