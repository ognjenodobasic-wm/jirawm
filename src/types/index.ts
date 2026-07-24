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
}

export type EditorMode = 'preview' | 'annotate';

export interface WindowBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface PendingEditor {
  dataUrl: string;
  thumbnailIndex: number;
  mode: EditorMode;
}

export interface AnnotationResult {
  dataUrl: string;
  thumbnailIndex: number;
}

export type PanelMode = 'single' | 'bulk' | 'workflows' | 'help';
