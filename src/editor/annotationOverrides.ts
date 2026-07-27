import type { MetadataOverrides } from '../types';

export function normalizeOverrides(overrides: MetadataOverrides | null): MetadataOverrides | null {
  if (!overrides) return null;
  const keys = Object.keys(overrides) as Array<keyof MetadataOverrides>;
  if (keys.length === 0) return null;
  return overrides;
}

export function overridesEqual(a: MetadataOverrides | null, b: MetadataOverrides | null): boolean {
  const na = normalizeOverrides(a);
  const nb = normalizeOverrides(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  const keysA = Object.keys(na).sort();
  const keysB = Object.keys(nb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i] as keyof MetadataOverrides;
    if (keysA[i] !== keysB[i]) return false;
    const va = na[key];
    const vb = nb[key];
    if (!va || !vb) return false;
    if (va.enabled !== vb.enabled || va.value !== vb.value) return false;
  }
  return true;
}
