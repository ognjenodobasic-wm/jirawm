import type { ScreenshotItem, MetadataPosition, CaptureDetailsSettings } from '../types';

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

export function buildCaptureDetailLines(
  screenshot: ScreenshotItem,
  settings: CaptureDetailsSettings,
): string[] {
  const md = screenshot.metadata;
  if (!md) return [];

  const items: string[] = [];
  if (settings.includeUrl && md.url) items.push(`URL — ${md.url}`);
  if (settings.includePageTitle && md.pageTitle) items.push(`Page — ${md.pageTitle}`);
  if (settings.includeTimestamp) items.push(`Captured — ${formatTimestamp(md.capturedAt)}`);

  if (settings.includeViewport) {
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
    if (viewportParts.length > 0) {
      items.push(`Viewport — ${viewportParts.join(' · ')}`);
    }
  }

  if (settings.includeBrowser) {
    const browserParts: string[] = [];
    if (md.browser) browserParts.push(md.browser);
    if (md.os) browserParts.push(md.os);
    if (browserParts.length > 0) {
      items.push(`Browser — ${browserParts.join(' · ')}`);
    }
  }

  return items;
}

export function buildCaptureDetailsADF(
  screenshots: ScreenshotItem[],
  settings: CaptureDetailsSettings,
): ADFNode[] | null {
  const captures = screenshots.filter((s): s is ScreenshotItem & { metadata: NonNullable<ScreenshotItem['metadata']> } =>
    s.origin === 'capture' && s.metadata !== null,
  );
  if (captures.length === 0) return null;

  const nodes: ADFNode[] = [];
  nodes.push({ type: 'rule' });
  nodes.push(paragraph('Captured with JiraWM', true));

  for (const screenshot of captures) {
    nodes.push(paragraph(screenshot.filename, true));

    const items = buildCaptureDetailLines(screenshot, settings);
    if (items.length === 0) continue;

    const list: ADFBulletListNode = {
      type: 'bulletList',
      content: items.map((text) => ({
        type: 'listItem',
        content: [paragraph(text)],
      })),
    };
    nodes.push(list);
  }

  return nodes;
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
