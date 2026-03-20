import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CANDIDATE_PATHS = [
  join(process.cwd(), 'src/data/epodExtractedShipments.json'),
  join(process.cwd(), 'src', 'data', 'epodExtractedShipments.json'),
];

let shipments = [];

for (const candidatePath of CANDIDATE_PATHS) {
  try {
    if (existsSync(candidatePath)) {
      shipments = JSON.parse(readFileSync(candidatePath, 'utf8'));
      console.log(`Loaded ${shipments.length} shipments from: ${candidatePath}`);
      break;
    }
  } catch {
    // Try the next candidate path.
  }
}

if (shipments.length === 0) {
  console.warn('Could not load shipment master JSON from any path');
}

const awbMap = new Map();
for (const shipment of shipments) {
  awbMap.set(normalizeAwb(shipment.awbNumber), shipment);
}

export function normalizeAwb(awb) {
  return awb.replace(/[\s\-_.]/g, '').toUpperCase();
}

export function findShipmentByAwb(awb) {
  return awbMap.get(normalizeAwb(awb)) ?? null;
}

export function findShipmentByFileName(fileName) {
  const clean = fileName.replace(/\.[^.]+$/, '');
  const byAwb = findShipmentByAwb(clean);
  if (byAwb) {
    return byAwb;
  }
  return shipments.find((shipment) => shipment.fileName === fileName) ?? null;
}

export function getAllShipments() {
  return shipments;
}
