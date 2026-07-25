export type TransparencyFill = 'white' | 'black';
export type MetadataPosition = 'top' | 'bottom';
export type CaptureDetailKey = 'url' | 'pageTitle' | 'timestamp' | 'viewport' | 'browser';

export type CaptureDetailOverride = {
  enabled: boolean;
  value: string;
};

export type MetadataOverrides = Partial<Record<CaptureDetailKey, CaptureDetailOverride>>;

export interface ImageSettings {
  quality: number; // 0.6 - 1.0, default 0.85
  maxWidth: number; // default 1920
  transparencyFill: TransparencyFill; // default 'white'
}

export interface NamingSettings {
  numberSingleScreenshots: boolean; // default true  -> 1.jpg, 2.jpg
  numberBulkFiles: boolean; // default true  -> "1 - screenshot.jpg"
}

export interface CaptureDetailsSettings {
  enabled: boolean; // master toggle, default true
  position: MetadataPosition; // default 'bottom'
  includeUrl: boolean; // default true
  includePageTitle: boolean; // default true
  includeTimestamp: boolean; // default true
  includeViewport: boolean; // default true
  includeBrowser: boolean; // default true
  stripQueryParams: boolean; // default true
  allowPerScreenshotEdit: boolean; // default true
}

export interface AppSettings {
  image: ImageSettings;
  naming: NamingSettings;
  captureDetails: CaptureDetailsSettings;
}

export interface CaptureMetadata {
  url: string | null;
  pageTitle: string | null;
  capturedAt: string; // ISO 8601 with local offset
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
  zoomFactor: number | null; // 1 = 100%
  browser: string | null; // e.g. "Chrome 138"
  os: string | null; // e.g. "macOS 15.2"
}

export interface AuthConfig {
  domain: string;
  email: string;
  apiToken: string;
  accountId: string;
}

export interface JiraField {
  id: string;
  name: string;
  required: boolean;
  schema?: { type: string; items?: string };
  allowedValues?: Array<{ id: string; value: string; name?: string }>;
}

export interface Workflow {
  id: string;
  name: string;
  projectKey: string; // e.g. "AT" — from dropdown, not manual input
  projectName: string; // display name
  issueType: string; // from dropdown based on project
  hasParent: boolean; // checkbox
  parentKey?: string; // e.g. "AT-45" — required if hasParent=true
  defaultAssignee?: string | null; // accountId or null = Unassigned
  defaultAssigneeName?: string; // display name for display purposes
  compression: {
    quality: number; // default 0.85
    maxWidth: number; // default 1920
  };
  requiredFieldDefaults: Record<string, string>;
  optionalFields: { fieldId: string; defaultValue?: string }[];
  fieldMeta?: JiraField[]; // cached from createmeta — not persisted with workflow
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  avatarUrls: { '24x24': string };
  active: boolean;
}

export interface AssignableUserCache {
  projectKey: string;
  users: JiraUser[];
  fetchedAt: string;
}

export interface IssueTypeMeta {
  id: string;
  name: string;
  fields: JiraField[];
}

export interface BulkTask {
  id: string;
  summary: string;
  description?: string;
  assignee?: string;
  screenshotBase64: string;
  status: 'waiting' | 'creating' | 'uploading' | 'done' | 'failed';
  issueKey?: string;
  error?: string;
  workflowId?: string;
  attachmentName?: string;
}

export interface ExportSnapshot {
  timestamp: string;
  count: number;
  names: string[];
}

export interface CompressionSettings {
  quality: number;
  maxWidth: number;
}

export interface ScreenshotItem {
  id: string;
  dataUrl: string;
  label?: string;
  annotated?: boolean;
  origin: 'capture' | 'upload';
  number: number | null; // sequence number, null when numbering is off
  filename: string; // final attachment filename, e.g. "1.jpg"
  metadata: CaptureMetadata | null; // only when origin === 'capture'
  metadataOverrides: MetadataOverrides | null;
}

export interface WindowBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface PendingEditor {
  dataUrl: string;
  screenshotId: string;
  origin: 'capture' | 'upload';
  metadata: CaptureMetadata | null;
  metadataOverrides: MetadataOverrides | null;
  captureDetailsSettings: CaptureDetailsSettings | null;
}

export interface AnnotationResult {
  dataUrl: string;
  screenshotId: string;
}

export type PanelMode = 'single' | 'bulk' | 'workflows' | 'help';
