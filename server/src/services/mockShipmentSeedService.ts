import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExtractedShipmentRecord {
    awbNumber: string;
    shipmentId: string;
    transporter: string;
    fileName: string;
    origin: string | null;
    originCity: string | null;
    consigneeName: string | null;
    destination: string | null;
    deliveredDate: string | null;
    packageCount: number;
    ocrSource: string;
    extractedTextSnippet: string | null;
    sortOrder: number;
}

interface SeedShipmentRecord {
    awbNumber: string;
    shipmentId: string;
    transporter: string;
    consigneeName: string | null;
    origin: string | null;
    originCity: string | null;
    destination: string | null;
    lineItems: Array<{ sku: string; description: string; sentQty: number }>;
}

let manifestCache: ExtractedShipmentRecord[] | null = null;

function getManifestPath() {
    return path.resolve(__dirname, '../../../src/data/epodExtractedShipments.json');
}

function loadManifest(): ExtractedShipmentRecord[] {
    if (manifestCache) return manifestCache;

    const manifestPath = getManifestPath();
    if (!fs.existsSync(manifestPath)) {
        manifestCache = [];
        return manifestCache;
    }

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);

    manifestCache = Array.isArray(parsed) ? parsed : [];
    return manifestCache;
}

function toOrigin(record: ExtractedShipmentRecord) {
    const parts = [record.origin, record.originCity].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

function createLineItems(record: ExtractedShipmentRecord) {
    const packageCount = Math.max(1, record.packageCount || 1);

    return [
        {
            sku: `SKU-${record.awbNumber.slice(-4).padStart(4, '0')}-A`,
            description: record.consigneeName
                ? `POD shipment for ${record.consigneeName}`
                : 'POD shipment package',
            sentQty: packageCount,
        },
    ];
}

function toSeedShipment(record: ExtractedShipmentRecord): SeedShipmentRecord {
    return {
        awbNumber: record.awbNumber,
        shipmentId: record.shipmentId,
        transporter: record.transporter,
        consigneeName: record.consigneeName,
        origin: record.origin,
        originCity: record.originCity,
        destination: record.destination,
        lineItems: createLineItems(record),
    };
}

export const mockShipmentSeedService = {
    loadExtractedShipments() {
        return loadManifest().map(toSeedShipment);
    },

    async ensureSeeded() {
        const shipments = this.loadExtractedShipments();

        for (const shipment of shipments) {
            await prisma.shipment.upsert({
                where: { awbNumber: shipment.awbNumber },
                update: {
                    consigneeName: shipment.consigneeName || shipment.awbNumber,
                    lineItems: JSON.stringify(shipment.lineItems),
                    origin: toOrigin({
                        awbNumber: shipment.awbNumber,
                        shipmentId: shipment.shipmentId,
                        transporter: shipment.transporter,
                        fileName: '',
                        origin: shipment.origin,
                        originCity: shipment.originCity,
                        consigneeName: shipment.consigneeName,
                        destination: shipment.destination,
                        deliveredDate: null,
                        packageCount: shipment.lineItems[0]?.sentQty || 1,
                        ocrSource: '',
                        extractedTextSnippet: null,
                        sortOrder: 0,
                    }),
                    destination: shipment.destination,
                },
                create: {
                    awbNumber: shipment.awbNumber,
                    consigneeName: shipment.consigneeName || shipment.awbNumber,
                    lineItems: JSON.stringify(shipment.lineItems),
                    origin: shipment.origin || shipment.originCity ? [shipment.origin, shipment.originCity].filter(Boolean).join(', ') : null,
                    destination: shipment.destination,
                },
            });
        }

        return shipments.length;
    },

    getShipmentFromFileName(fileName: string) {
        const awbNumber = path.parse(fileName).name;
        return this.getShipmentByAwb(awbNumber);
    },

    getShipmentByAwb(awbNumber: string) {
        const shipment = this.loadExtractedShipments().find((item) => item.awbNumber === awbNumber);
        return shipment || null;
    },
};
