const API_BASE = '/api';

async function fetchJson(url: string, options?: RequestInit) {
    let res: Response;
    try {
        res = await fetch(url, options);
    } catch {
        throw new Error('Backend service is unavailable. Start the API server on port 3001.');
    }

    if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const err = await (contentType.includes('application/json')
            ? res.json().catch(() => ({ error: res.statusText }))
            : Promise.resolve({
                error: res.status >= 500
                    ? 'Backend service is unavailable. Start the API server on port 3001.'
                    : res.statusText,
            }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

// Upload
export async function uploadPod(file: File, metadata?: { source?: string; awbNumber?: string; uploadedBy?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.source) formData.append('source', metadata.source);
    if (metadata?.awbNumber) formData.append('awbNumber', metadata.awbNumber);
    if (metadata?.uploadedBy) formData.append('uploadedBy', metadata.uploadedBy);
    return fetchJson(`${API_BASE}/pod/upload`, { method: 'POST', body: formData });
}

export async function uploadPodBulk(files: File[], metadata?: { source?: string; uploadedBy?: string }) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (metadata?.source) formData.append('source', metadata.source);
    if (metadata?.uploadedBy) formData.append('uploadedBy', metadata.uploadedBy);
    return fetchJson(`${API_BASE}/pod/upload-bulk`, { method: 'POST', body: formData });
}

// List & Detail
export async function listPods(filters?: { status?: string; awbNumber?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.awbNumber) params.set('awbNumber', filters.awbNumber);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    return fetchJson(`${API_BASE}/pod/list?${params}`);
}

export async function getPodDetail(id: string) {
    return fetchJson(`${API_BASE}/pod/${id}`);
}

export async function getPodStats() {
    return fetchJson(`${API_BASE}/pod/stats/summary`);
}

// Processing
export async function processOcr(id: string) {
    return fetchJson(`${API_BASE}/pod/${id}/process`, { method: 'POST' });
}

export async function processBatch(podIds?: string[], batchId?: string) {
    return fetchJson(`${API_BASE}/pod/process-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podIds, batchId }),
    });
}

// Reconciliation
export async function reconcilePod(id: string) {
    return fetchJson(`${API_BASE}/pod/${id}/reconcile`, { method: 'POST' });
}

export async function getReconResults(id: string) {
    return fetchJson(`${API_BASE}/pod/${id}/recon`);
}

// Review
export async function reviewLine(podId: string, lineId: string, data: { action: string; receivedQty?: number; damagedQty?: number; note?: string }) {
    return fetchJson(`${API_BASE}/pod/${podId}/line/${lineId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function resolveException(podId: string, exId: string, resolvedBy?: string) {
    return fetchJson(`${API_BASE}/pod/${podId}/exception/${exId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy }),
    });
}

// Approval
export async function approvePod(id: string, actedBy?: string, comment?: string) {
    return fetchJson(`${API_BASE}/pod/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actedBy, comment }),
    });
}

export async function rejectPod(id: string, actedBy?: string, comment?: string) {
    return fetchJson(`${API_BASE}/pod/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actedBy, comment }),
    });
}

export async function getPendingApprovals(level?: number) {
    const params = level ? `?level=${level}` : '';
    return fetchJson(`${API_BASE}/pod/approvals/pending${params}`);
}

// Shipments
export async function listShipments(awbNumber?: string) {
    const params = awbNumber ? `?awbNumber=${awbNumber}` : '';
    return fetchJson(`${API_BASE}/shipments${params}`);
}

export async function createShipment(data: { awbNumber: string; consigneeName: string; lineItems: any[]; origin?: string; destination?: string }) {
    return fetchJson(`${API_BASE}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function bulkCreateShipments(shipments: any[]) {
    return fetchJson(`${API_BASE}/shipments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipments }),
    });
}
