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
  schema: { type: string };
  allowedValues?: Array<{ id: string; name: string; value?: string }>;
}

export interface Workflow {
  id: string;
  name: string;
  project: string;
  parentKey: string;
  issueType: string;
  summaryPrefix?: string;
  compression: { quality: number; maxWidth: number };
  presets: Record<string, string>;
  requiredFields: JiraField[];
  optionalFields: JiraField[];
}

export interface BulkTask {
  id: string;
  summary: string;
  screenshotDataUrl: string;
  workflowId: string;
  status: 'waiting' | 'creating' | 'uploading' | 'done' | 'failed';
  jiraKey?: string;
  error?: string;
}

export interface ExportSnapshot {
  timestamp: string;
  count: number;
  names: string[];
}

export type PanelMode = 'single' | 'bulk';
