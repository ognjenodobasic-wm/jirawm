import type { AppSettings, CompressionSettings } from '../types';

function promiseGet<T>(
  area: chrome.storage.StorageArea,
  key: string,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    area.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve((result[key] as T) ?? null);
      }
    });
  });
}

function promiseSet<T>(
  area: chrome.storage.StorageArea,
  key: string,
  value: T,
): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

export function getLocal<T>(key: string): Promise<T | null> {
  return promiseGet<T>(chrome.storage.local, key);
}

export function setLocal<T>(key: string, value: T): Promise<void> {
  return promiseSet<T>(chrome.storage.local, key, value);
}

export function getSync<T>(key: string): Promise<T | null> {
  return promiseGet<T>(chrome.storage.sync, key);
}

export function setSync<T>(key: string, value: T): Promise<void> {
  return promiseSet<T>(chrome.storage.sync, key, value);
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  image: {
    quality: 0.85,
    maxWidth: 1920,
    transparencyFill: 'white',
  },
  naming: {
    numberSingleScreenshots: true,
    numberBulkFiles: true,
  },
  captureDetails: {
    enabled: true,
    position: 'bottom',
    includeUrl: true,
    includePageTitle: true,
    includeTimestamp: true,
    includeViewport: true,
    includeBrowser: true,
    stripQueryParams: true,
  },
};

const APP_SETTINGS_KEY = 'jirawm_app_settings';
const LEGACY_COMPRESSION_KEY = 'jirawm_compression';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, overrides: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const baseValue = base[key];
    const overrideValue = isObject(overrides) ? overrides[key] : undefined;
    if (isObject(baseValue)) {
      merged[key] = deepMerge(baseValue, overrideValue);
    } else {
      merged[key] = overrideValue !== undefined ? overrideValue : baseValue;
    }
  }
  return merged;
}

function mergeAppSettings(stored: AppSettings | null): AppSettings {
  return deepMerge(
    DEFAULT_APP_SETTINGS as unknown as Record<string, unknown>,
    stored,
  ) as unknown as AppSettings;
}

export async function getAppSettings(): Promise<AppSettings> {
  let stored = await getLocal<AppSettings>(APP_SETTINGS_KEY);

  // Migration: read legacy compression settings once and fold into new shape.
  if (!stored) {
    const legacy = await getLocal<CompressionSettings>(LEGACY_COMPRESSION_KEY);
    if (legacy) {
      stored = {
        ...DEFAULT_APP_SETTINGS,
        image: {
          ...DEFAULT_APP_SETTINGS.image,
          quality: legacy.quality,
          maxWidth: legacy.maxWidth,
        },
      };
      await setLocal(APP_SETTINGS_KEY, stored);
    }
  }

  return mergeAppSettings(stored);
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await setLocal(APP_SETTINGS_KEY, settings);
}

