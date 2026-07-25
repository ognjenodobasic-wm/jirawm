const CAPTURE_ORIGIN = '<all_urls>';

export async function hasCapturePermission(): Promise<boolean> {
  return chrome.permissions.contains({ origins: [CAPTURE_ORIGIN] });
}

export function requestCapturePermission(): Promise<boolean> {
  return chrome.permissions.request({ origins: [CAPTURE_ORIGIN] });
}
