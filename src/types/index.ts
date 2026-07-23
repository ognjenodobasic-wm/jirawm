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
  compression: {
    quality: number; // default 0.85
    maxWidth: number; // default 1920
  };
  requiredFieldDefaults: Record<string, string>;
  optionalFields: { fieldId: string; defaultValue?: string }[];
  fieldMeta: JiraField[]; // cached from createmeta
}

export interface IssueTypeMeta {
  id: string;
  name: string;
  fields: JiraField[];
}

export interface BulkTask {
  id: string;
  summary: string;
  screenshotBase64: string;
  status: 'waiting' | 'creating' | 'uploading' | 'done' | 'failed';
  issueKey?: string;
  error?: string;
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
}

export type PanelMode = 'single' | 'bulk';
