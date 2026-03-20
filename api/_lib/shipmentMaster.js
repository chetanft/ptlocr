"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAwb = normalizeAwb;
exports.findShipmentByAwb = findShipmentByAwb;
exports.findShipmentByFileName = findShipmentByFileName;
exports.getAllShipments = getAllShipments;
const fs_1 = require("fs");
const path_1 = require("path");
const url_1 = require("url");
// ESM-compatible __dirname replacement
const currentDir = (() => {
    try {
        return (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
    }
    catch {
        return process.cwd();
    }
})();
// Try multiple paths to find the shipment data JSON
const CANDIDATE_PATHS = [
    (0, path_1.join)(process.cwd(), 'src/data/epodExtractedShipments.json'),
    (0, path_1.join)(currentDir, '../../src/data/epodExtractedShipments.json'),
    (0, path_1.join)(currentDir, '../../../src/data/epodExtractedShipments.json'),
    (0, path_1.join)(process.cwd(), 'src', 'data', 'epodExtractedShipments.json'),
];
let shipments = [];
for (const candidatePath of CANDIDATE_PATHS) {
    try {
        if ((0, fs_1.existsSync)(candidatePath)) {
            shipments = JSON.parse((0, fs_1.readFileSync)(candidatePath, 'utf8'));
            console.log(`Loaded ${shipments.length} shipments from: ${candidatePath}`);
            break;
        }
    }
    catch {
        // Try next path
    }
}
if (shipments.length === 0) {
    console.warn('Could not load shipment master JSON from any path');
}
// Build lookup map
const awbMap = new Map();
for (const s of shipments) {
    awbMap.set(normalizeAwb(s.awbNumber), s);
}
function normalizeAwb(awb) {
    return awb.replace(/[\s\-_.]/g, '').toUpperCase();
}
function findShipmentByAwb(awb) {
    return awbMap.get(normalizeAwb(awb)) ?? null;
}
function findShipmentByFileName(fileName) {
    const clean = fileName.replace(/\.[^.]+$/, '');
    const byAwb = findShipmentByAwb(clean);
    if (byAwb)
        return byAwb;
    return shipments.find(s => s.fileName === fileName) ?? null;
}
function getAllShipments() {
    return shipments;
}
