const STORAGE_KEY = 'epod-shipment-status-overrides';
const EVENT_NAME = 'epod-shipment-status-updated';
const EMPTY_STATUS_OVERRIDES: ShipmentStatusMap = {};

export type EpodShipmentStatus = 'Pending Submission' | 'Pending Approval' | 'Rejected' | 'Approved';

type ShipmentStatusMap = Record<string, EpodShipmentStatus>;

let cachedStatusOverrides: ShipmentStatusMap = EMPTY_STATUS_OVERRIDES;
let cachedRawStatusOverrides: string | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getShipmentStatusOverrides(): ShipmentStatusMap {
  if (!canUseStorage()) {
    return cachedStatusOverrides;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedRawStatusOverrides = null;
      cachedStatusOverrides = EMPTY_STATUS_OVERRIDES;
      return cachedStatusOverrides;
    }

    if (raw === cachedRawStatusOverrides) {
      return cachedStatusOverrides;
    }

    const parsed = JSON.parse(raw) as ShipmentStatusMap;
    cachedRawStatusOverrides = raw;
    cachedStatusOverrides = parsed;
    return cachedStatusOverrides;
  } catch {
    cachedRawStatusOverrides = null;
    cachedStatusOverrides = EMPTY_STATUS_OVERRIDES;
    return cachedStatusOverrides;
  }
}

function setShipmentStatusOverrides(next: ShipmentStatusMap) {
  if (!canUseStorage()) {
    return;
  }

  cachedRawStatusOverrides = JSON.stringify(next);
  cachedStatusOverrides = next;
  window.localStorage.setItem(STORAGE_KEY, cachedRawStatusOverrides);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeShipmentStatusOverrides(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener('storage', listener);

  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener('storage', listener);
  };
}

export function markShipmentsApproved(awbs: Array<string | null | undefined>) {
  const validAwbs = awbs.filter((awb): awb is string => Boolean(awb && awb.trim()));
  if (validAwbs.length === 0) {
    return;
  }

  const next = { ...getShipmentStatusOverrides() };
  for (const awb of validAwbs) {
    next[awb] = 'Approved';
  }
  setShipmentStatusOverrides(next);
}

export function resetShipmentStatusOverrides() {
  if (!canUseStorage()) {
    return;
  }

  cachedRawStatusOverrides = null;
  cachedStatusOverrides = EMPTY_STATUS_OVERRIDES;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}
