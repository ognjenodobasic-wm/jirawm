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

export function removeLocal(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
