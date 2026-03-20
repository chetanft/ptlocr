export const sampleShipments = [
    {
        awbNumber: 'AWB-2024-001',
        consigneeName: 'Acme Corp',
        lineItems: [
            { sku: 'SKU-001', description: 'Electronic Components Box A', sentQty: 100 },
            { sku: 'SKU-002', description: 'Electronic Components Box B', sentQty: 50 },
            { sku: 'SKU-003', description: 'Packaging Materials', sentQty: 200 },
        ],
        origin: 'Mumbai',
        destination: 'Delhi',
    },
    {
        awbNumber: 'AWB-2024-002',
        consigneeName: 'Global Logistics Ltd',
        lineItems: [
            { sku: 'SKU-010', description: 'Textile Rolls Premium', sentQty: 25 },
            { sku: 'SKU-011', description: 'Dye Chemicals Container', sentQty: 10 },
        ],
        origin: 'Chennai',
        destination: 'Bangalore',
    },
    {
        awbNumber: 'AWB-2024-003',
        consigneeName: 'FastTrack Retailers',
        lineItems: [
            { sku: 'SKU-020', description: 'Consumer Electronics - Phones', sentQty: 500 },
            { sku: 'SKU-021', description: 'Consumer Electronics - Tablets', sentQty: 200 },
            { sku: 'SKU-022', description: 'Accessories Pack', sentQty: 1000 },
            { sku: 'SKU-023', description: 'Display Units', sentQty: 50 },
        ],
        origin: 'Hyderabad',
        destination: 'Pune',
    },
];
