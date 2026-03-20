const STORAGE_KEY = 'epod-shipment-status-overrides';
const EVENT_NAME = 'epod-shipment-status-updated';

export type EpodShipmentStatus = 'Pending Submission' | 'Pending Approval' | 'Rejected' | 'Approved';

type ShipmentStatusMap = Record<string, EpodShipmentStatus>;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getShipmentStatusOverrides(): ShipmentStatusMap {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShipmentStatusMap) : {};
  } catch {
    return {};
  }
}

function setShipmentStatusOverrides(next: ShipmentStatusMap) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
