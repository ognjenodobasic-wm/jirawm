import type { ScreenshotItem, MetadataPosition, CaptureDetailsSettings, CaptureDetailKey } from '../types';

type ADFTextNode = { type: 'text'; text: string; marks?: Array<{ type: string }> };
type ADFParagraphNode = { type: 'paragraph'; content: ADFTextNode[] };
type ADFRuleNode = { type: 'rule' };
type ADFListItemNode = { type: 'listItem'; content: ADFParagraphNode[] };
type ADFBulletListNode = { type: 'bulletList'; content: ADFListItemNode[] };
export type ADFNode = ADFRuleNode | ADFParagraphNode | ADFBulletListNode;
export type ADFDoc = { type: 'doc'; version: 1; content: ADFNode[] };

function paragraph(text: string, strong = false): ADFParagraphNode {
  const node: ADFTextNode = { type: 'text', text };
  if (strong) node.marks = [{ type: 'strong' }];
  return { type: 'paragraph', content: [node] };
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const offset = -date.getTimezoneOffset();
  const abs = Math.abs(offset);
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  const tz = `UTC${sign}${hours}:${minutes}`;
  return (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ` +
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${tz}`
  );
}

/**
 * Per-field resolution result returned by buildCaptureDetailFields.
 */
export interface CaptureDetailField {
  key: CaptureDetailKey;
  label: string;
  generated: string;
  value: string;
  enabled: boolean;
  isOverridden: boolean;
}

const CAPTURE_DETAIL_LABELS: Record<CaptureDetailKey, string> = {
  url: 'URL',
  pageTitle: 'Page',
  timestamp: 'Captured',
  viewport: 'Viewport',
  browser: 'Browser',
};

const CAPTURE_DETAIL_SETTINGS_KEY: Record<CaptureDetailKey, keyof CaptureDetailsSettings> = {
  url: 'includeUrl',
  pageTitle: 'includePageTitle',
  timestamp: 'includeTimestamp',
  viewport: 'includeViewport',
  browser: 'includeBrowser',
};

function generateValue(key: CaptureDetailKey, screenshot: ScreenshotItem): string {
  const md = screenshot.metadata;
  if (!md) return '';

  switch (key) {
    case 'url': {
      return md.url ?? '';
    }
    case 'pageTitle': {
      return md.pageTitle ?? '';
    }
    case 'timestamp': {
      return formatTimestamp(md.capturedAt);
    }
    case 'viewport': {
      const viewportParts: string[] = [];
      if (md.viewportWidth !== null && md.viewportHeight !== null) {
        viewportParts.push(`${md.viewportWidth}x${md.viewportHeight}`);
      }
      if (md.devicePixelRatio !== null) {
        viewportParts.push(`DPR ${md.devicePixelRatio}`);
      }
      if (md.zoomFactor !== null && md.zoomFactor !== 1) {
        viewportParts.push(`zoom ${Math.round(md.zoomFactor * 100)}%`);
      }
      return viewportParts.join(' · ');
    }
    case 'browser': {
      const browserParts: string[] = [];
      if (md.browser) browserParts.push(md.browser);
      if (md.os) browserParts.push(md.os);
      return browserParts.join(' · ');
    }
  }
}

/**
 * Resolves per-screenshot capture detail fields with override support.
 *
 * Resolution order per field:
 * 1. Global setting gate — if settings.includeX is false, field is excluded.
 * 2. Empty generated value — excluded entirely.
 * 3. metadataOverrides[key] — use its enabled/value, set isOverridden when value differs.
 * 4. Default — enabled=true, value=generated, isOverridden=false.
 */
export function buildCaptureDetailFields(
  screenshot: ScreenshotItem,
  settings: CaptureDetailsSettings,
): CaptureDetailField[] {
  const keys: CaptureDetailKey[] = ['url', 'pageTitle', 'timestamp', 'viewport', 'browser'];
  const overrides = screenshot.metadataOverrides;
  const result: CaptureDetailField[] = [];

  for (const key of keys) {
    // 1. Global setting gate
    const settingKey = CAPTURE_DETAIL_SETTINGS_KEY[key];
    if (!settings[settingKey]) continue;

    // 2. Generate value
    const generated = generateValue(key, screenshot);

    // 3. Empty generated value → exclude
    if (!generated) continue;

    // 4. Per-screenshot override
    const override = overrides?.[key];
    if (override) {
      const isOverridden = override.value !== generated;
      result.push({
        key,
        label: CAPTURE_DETAIL_LABELS[key],
        generated,
        value: override.value,
        enabled: override.enabled,
        isOverridden,
      });
    } else {
      result.push({
        key,
        label: CAPTURE_DETAIL_LABELS[key],
        generated,
        value: generated,
        enabled: true,
        isOverridden: false,
      });
    }
  }

  return result;
}

/**
 * Thin wrapper over buildCaptureDetailFields — preserves the original
 * buildCaptureDetailLines interface for existing callers.
 */
export function buildCaptureDetailLines(
  screenshot: ScreenshotItem,
  settings: CaptureDetailsSettings,
): string[] {
  return buildCaptureDetailFields(screenshot, settings)
    .filter((f) => f.enabled)
    .map((f) => `${f.label} — ${f.value}`);
}

/**
 * Builds the ADF capture-details block, respecting per-screenshot overrides
 * and disabled fields. If every field of a screenshot is disabled, its block
 * (filename paragraph + bullet list) is omitted entirely.
 * Returns null when no screenshots have any enabled content.
 */
export function buildCaptureDetailsADF(
  screenshots: ScreenshotItem[],
  settings: CaptureDetailsSettings,
): ADFNode[] | null {
  const captures = screenshots.filter((s): s is ScreenshotItem & { metadata: NonNullable<ScreenshotItem['metadata']> } =>
    s.origin === 'capture' && s.metadata !== null,
  );
  if (captures.length === 0) return null;

  const nodes: ADFNode[] = [];
  let hasAnyContent = false;

  for (const screenshot of captures) {
    const fields = buildCaptureDetailFields(screenshot, settings);
    const enabledFields = fields.filter((f) => f.enabled);

    // If every field is disabled, skip this screenshot's block entirely
    if (enabledFields.length === 0) continue;

    if (!hasAnyContent) {
      nodes.push({ type: 'rule' });
      nodes.push(paragraph('Captured with JiraWM', true));
      hasAnyContent = true;
    }

    nodes.push(paragraph(screenshot.filename, true));

    const list: ADFBulletListNode = {
      type: 'bulletList',
      content: enabledFields.map((f) => ({
        type: 'listItem',
        content: [paragraph(`${f.label} — ${f.value}`)],
      })),
    };
    nodes.push(list);
  }

  return hasAnyContent ? nodes : null;
}

/**
 * Returns true when the screenshot has metadataOverrides that actually
 * change something — either a field is disabled or a value differs from
 * the generated value.
 */
export function hasMetadataOverrides(screenshot: ScreenshotItem): boolean {
  const overrides = screenshot.metadataOverrides;
  if (!overrides) return false;

  const keys: CaptureDetailKey[] = ['url', 'pageTitle', 'timestamp', 'viewport', 'browser'];
  for (const key of keys) {
    const override = overrides[key];
    if (!override) continue;
    const generated = generateValue(key, screenshot);
    if (!override.enabled || override.value !== generated) {
      return true;
    }
  }
  return false;
}

function toADFParagraphs(text: string): ADFParagraphNode[] {
  return text.split('\n').map((line) => paragraph(line || ' '));
}

export function buildDescriptionADF(
  userText: string,
  screenshots: ScreenshotItem[],
  position: MetadataPosition,
  settings: CaptureDetailsSettings,
): ADFDoc {
  const userNodes = userText.trim() ? toADFParagraphs(userText.trim()) : [];
  const detailsNodes = buildCaptureDetailsADF(screenshots, settings);

  let content: ADFNode[] = [];

  if (position === 'bottom') {
    content = [...userNodes];
    if (detailsNodes) content.push(...detailsNodes);
  } else {
    if (detailsNodes) {
      // Rule goes between details and user text when details are on top.
      const detailsWithoutTrailingRule = detailsNodes.slice(0, -1);
      const rule = detailsNodes[detailsNodes.length - 1];
      content = [...detailsWithoutTrailingRule];
      if (userNodes.length > 0) {
        content.push(rule);
        content.push(...userNodes);
      } else {
        content.push(rule);
      }
    } else {
      content = [...userNodes];
    }
  }

  if (content.length === 0) {
    content = [paragraph(' ')];
  }

  return { type: 'doc', version: 1, content };
}