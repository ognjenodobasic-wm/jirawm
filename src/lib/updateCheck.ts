import { getLocal, setLocal } from './storage';

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  checkedAt: string;
}

const UPDATE_INFO_KEY = 'updateInfo';
const RELEASES_URL = 'https://api.github.com/repos/ognjenodobasic-wm/jirawm/releases/latest';

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.');
  const toNum = (value: string | undefined) => {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  };
  return [toNum(parts[0]), toNum(parts[1]), toNum(parts[2])];
}

export function isNewerVersion(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true;
    if (r[i] < l[i]) return false;
  }
  return false;
}

export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(RELEASES_URL);
    if (!response.ok) return null;

    const data = await response.json();
    const tagName: string | undefined = data?.tag_name;
    if (!tagName) return null;

    const assets: Array<{ name?: string; browser_download_url?: string }> = Array.isArray(data?.assets)
      ? data.assets
      : [];
    const zipAsset = assets.find((asset) => asset.name?.endsWith('.zip'));
    if (!zipAsset?.browser_download_url) return null;

    return {
      latestVersion: tagName.replace(/^v/, ''),
      downloadUrl: zipAsset.browser_download_url,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<void> {
  const currentVersion = chrome.runtime.getManifest().version;
  const result = await fetchLatestRelease();
  if (!result) return;

  if (isNewerVersion(result.latestVersion, currentVersion)) {
    await setLocal(UPDATE_INFO_KEY, result);
  } else {
    const existing = await getLocal(UPDATE_INFO_KEY);
    if (existing) {
      await chrome.storage.local.remove(UPDATE_INFO_KEY);
    }
  }
}
