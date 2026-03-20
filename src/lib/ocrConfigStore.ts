type StoredFieldMappings = Record<string, unknown>;

export interface StoredOcrConfig {
  id: string;
  moduleCode: string;
  consignorCode: string | null;
  transporterCode: string | null;
  prompt: string | null;
  fieldMappings: StoredFieldMappings;
  updatedAt: string;
  updatedBy?: string | null;
  isActive: boolean;
}

const STORAGE_KEY = 'ocr-config-store';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getConfigKey(moduleCode: string, consignorCode?: string | null, transporterCode?: string | null) {
  return `${moduleCode}|${consignorCode ?? ''}|${transporterCode ?? ''}`;
}

function readStore(): Record<string, StoredOcrConfig> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredOcrConfig>) : {};
  } catch {
    return {};
  }
}

function writeStore(value: Record<string, StoredOcrConfig>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getStoredOcrConfig(moduleCode: string, consignorCode?: string | null, transporterCode?: string | null): StoredOcrConfig | null {
  const store = readStore();

  const keys = [
    transporterCode && consignorCode ? getConfigKey(moduleCode, consignorCode, transporterCode) : null,
    consignorCode ? getConfigKey(moduleCode, consignorCode, null) : null,
    getConfigKey(moduleCode, null, null),
  ].filter((value): value is string => Boolean(value));

  for (const key of keys) {
    const config = store[key];
    if (config?.isActive !== false) {
      return config;
    }
  }

  return null;
}

export function saveStoredOcrConfig(input: {
  moduleCode: string;
  consignorCode?: string | null;
  transporterCode?: string | null;
  prompt?: string | null;
  fieldMappings?: StoredFieldMappings;
  updatedBy?: string | null;
}): StoredOcrConfig {
  const store = readStore();
  const key = getConfigKey(input.moduleCode, input.consignorCode, input.transporterCode);
  const nextConfig: StoredOcrConfig = {
    id: key,
    moduleCode: input.moduleCode,
    consignorCode: input.consignorCode ?? null,
    transporterCode: input.transporterCode ?? null,
    prompt: input.prompt ?? null,
    fieldMappings: input.fieldMappings ?? {},
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? null,
    isActive: true,
  };

  store[key] = nextConfig;
  writeStore(store);
  return nextConfig;
}

export function listStoredOcrConfigs(): StoredOcrConfig[] {
  return Object.values(readStore())
    .filter((config) => config.isActive !== false)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
