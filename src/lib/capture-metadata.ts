import type { CaptureDetailsSettings, CaptureMetadata } from '../types';

interface NavigatorUAData {
  brands: Array<{ brand: string; version: string }>;
  platform: string;
}

function parseBrowser(): { browser: string | null; os: string | null } {
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData) {
    const brands = uaData.brands;
    const brand = brands.find((b: { brand: string; version: string }) => b.brand !== 'Not(A:Brand' && b.brand !== 'Not?A_Brand');
    const browser = brand ? `${brand.brand} ${brand.version}` : null;
    const os = uaData.platform || null;
    return { browser, os };
  }

  const ua = navigator.userAgent;
  let browser: string | null = null;
  let os: string | null = null;

  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  const safariMatch = ua.match(/Version\/(\d+).*Safari\//);
  const edgeMatch = ua.match(/Edg\/(\d+)/);

  if (edgeMatch) browser = `Edge ${edgeMatch[1]}`;
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1]}`;

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

function formatLocalISO(): string {
  const now = new Date();
  const tzOffset = -now.getTimezoneOffset();
  const absOffset = Math.abs(tzOffset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  const sign = tzOffset >= 0 ? '+' : '-';
  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0') +
    'T' +
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0') +
    ':' +
    String(now.getSeconds()).padStart(2, '0') +
    sign +
    hours +
    ':' +
    minutes
  );
}

export async function collectCaptureMetadata(
  tabId: number,
  capturedImageWidth: number,
  capturedImageHeight: number,
  settings: CaptureDetailsSettings,
): Promise<CaptureMetadata> {
  const capturedAt = formatLocalISO();

  if (!settings.enabled) {
    return {
      url: null,
      pageTitle: null,
      capturedAt,
      viewportWidth: null,
      viewportHeight: null,
      devicePixelRatio: null,
      zoomFactor: null,
      browser: null,
      os: null,
    };
  }

  let url: string | null = null;
  let pageTitle: string | null = null;

  try {
    const tab = await chrome.tabs.get(tabId);
    const rawUrl = settings.includeUrl ? tab.url ?? null : null;
    if (rawUrl && settings.stripQueryParams) {
      try {
        const parsed = new URL(rawUrl);
        url = parsed.origin + parsed.pathname;
      } catch {
        url = rawUrl;
      }
    } else {
      url = rawUrl;
    }
    pageTitle = settings.includePageTitle ? tab.title ?? null : null;
  } catch {
    // Degrade gracefully — a single failure should not block capture.
  }

  let viewportWidth: number | null = null;
  let viewportHeight: number | null = null;
  let devicePixelRatio: number | null = null;
  let zoomFactor: number | null = null;

  if (settings.includeViewport) {
    try {
      devicePixelRatio = window.devicePixelRatio;
    } catch {
      devicePixelRatio = null;
    }

    try {
      zoomFactor = await chrome.tabs.getZoom(tabId);
    } catch {
      zoomFactor = 1;
    }

    const dpr = devicePixelRatio ?? 1;
    const zoom = zoomFactor ?? 1;

    // chrome.tabs.captureVisibleTab returns the viewport rendered at physical resolution:
    // imageWidthPhysical = cssViewportWidth * zoom * dpr
    // Rounding can be off by about 1px because of scrollbar width and subpixel layout.
    viewportWidth = Math.round(capturedImageWidth / (dpr * zoom));
    viewportHeight = Math.round(capturedImageHeight / (dpr * zoom));
  }

  let browser: string | null = null;
  let os: string | null = null;

  if (settings.includeBrowser) {
    try {
      const parsed = parseBrowser();
      browser = parsed.browser;
      os = parsed.os;
    } catch {
      // Degrade gracefully.
    }
  }

  return {
    url,
    pageTitle,
    capturedAt,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    zoomFactor,
    browser,
    os,
  };
}
