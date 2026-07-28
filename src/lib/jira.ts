import type {
  AuthConfig,
  IssueTypeMeta,
  JiraField,
  JiraUser,
  ScreenshotItem,
  MetadataPosition,
  CaptureDetailsSettings,
} from '../types';
import { buildDescriptionADF, type ADFDoc } from './capture-adf';
import { getLocal, setLocal } from './storage';

let _auth: AuthConfig | null = null;

export function setAuth(config: AuthConfig): void {
  _auth = config;
}

function requireAuth(): AuthConfig {
  if (!_auth) throw new Error('Jira auth not configured. Call setAuth() first.');
  return _auth;
}

function getHeaders(): HeadersInit {
  const { email, apiToken } = requireAuth();
  return {
    Authorization: `Basic ${btoa(`${email}:${apiToken}`)}`,
    'Content-Type': 'application/json',
  };
}

function baseUrl(): string {
  return `https://${requireAuth().domain}.atlassian.net/rest/api/3`;
}

function formatJiraErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const parts: string[] = [];
    if (Array.isArray(parsed.errorMessages) && parsed.errorMessages.length > 0) {
      parts.push(parsed.errorMessages.join('; '));
    }
    if (parsed.errors && typeof parsed.errors === 'object') {
      const errorLines = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`);
      if (errorLines.length > 0) parts.push(errorLines.join('\n'));
    }
    if (parts.length > 0) return parts.join('\n');
    return body;
  } catch {
    return body;
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira ${res.status} ${res.statusText}: ${formatJiraErrorBody(body)}`);
  }
  return res.status === 204 ? null : res.json();
}

function toADF(text: string): ADFDoc {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function isADFDoc(value: unknown): value is ADFDoc {
  return Boolean(value && typeof value === 'object' && (value as ADFDoc).type === 'doc');
}

function buildDescriptionField(
  description: unknown,
  options?: {
    screenshots: ScreenshotItem[];
    position: MetadataPosition;
    captureDetailsSettings: CaptureDetailsSettings;
  },
): ADFDoc {
  if (isADFDoc(description)) return description;
  if (options) {
    const userText = typeof description === 'string' ? description : '';
    return buildDescriptionADF(userText, options.screenshots, options.position, options.captureDetailsSettings);
  }
  return toADF(typeof description === 'string' ? description : '');
}

function serializeField(fieldId: string, value: string, fieldMeta: JiraField[]): unknown {
  const field = fieldMeta.find((f) => f.id === fieldId);
  if (!field) return value;
  switch (field.schema?.type) {
    case 'option':
      return { value };
    case 'priority':
      return { name: value };
    case 'user':
      return { accountId: value };
    case 'array':
      if (field.schema?.items === 'option') return [{ value }];
      if (field.schema?.items === 'string') return [value];
      return [value];
    case 'number':
      return Number(value);
    default:
      return value;
  }
}

export async function testConnection(): Promise<{ accountId: string; displayName: string }> {
  const data = (await apiFetch('/myself')) as { accountId: string; displayName: string };
  return { accountId: data.accountId, displayName: data.displayName };
}

export async function getProjects(): Promise<Array<{ id: string; key: string; name: string }>> {
  const data = (await apiFetch('/project?status=live')) as Array<{ id: string; key: string; name: string }>;
  return data
    .map(({ id, key, name }) => ({ id, key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function searchIssues(
  query: string,
  projectId: string,
  projectKey: string,
): Promise<Array<{ key: string; summary: string; isSubtask: boolean }>> {
  const trimmed = query.trim();
  const results: Array<{ key: string; summary: string; isSubtask: boolean }> = [];
  const seen = new Set<string>();

  function addResult(key: string, summary: string, isSubtask = false) {
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ key, summary, isSubtask });
    }
  }

  // 1. Direct key lookup if query matches issue key pattern
  if (/^[A-Za-z]+-\d+$/.test(trimmed)) {
    try {
      const issue = (await apiFetch(
        `/issue/${trimmed.toUpperCase()}?fields=summary,issuetype`,
      )) as { key: string; fields: { summary: string; issuetype: { subtask: boolean } } };
      addResult(issue.key, issue.fields.summary, issue.fields.issuetype.subtask);
    } catch (err) {
      console.warn('Direct key lookup failed:', err);
    }
  }

  // 2. Always call /issue/picker
  try {
    const pickerData = (await apiFetch(
      `/issue/picker?query=${encodeURIComponent(trimmed)}&currentProjectId=${encodeURIComponent(projectId)}&showSubTasks=false`,
    )) as {
      sections: Array<{
        issues?: Array<{ key: string; summaryText?: string; summary?: string }>;
      }>;
    };
    for (const section of pickerData.sections ?? []) {
      for (const issue of section.issues ?? []) {
        addResult(issue.key, issue.summaryText ?? issue.summary ?? '', false);
      }
    }
  } catch (err) {
    console.warn('Picker search failed:', err);
  }

  // 3. Always call JQL search (empty query skipped)
  if (trimmed) {
    try {
      const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const jqlData = (await apiFetch('/search/jql', {
        method: 'POST',
        body: JSON.stringify({
          jql: `project = "${projectKey}" AND summary ~ "${escaped}*" ORDER BY updated DESC`,
          maxResults: 50,
          fields: ['summary', 'issuetype'],
        }),
      })) as {
        issues: Array<{ key: string; fields: { summary: string; issuetype: { subtask: boolean } } }>;
      };
      for (const issue of jqlData.issues ?? []) {
        addResult(issue.key, issue.fields.summary, issue.fields.issuetype.subtask);
      }
    } catch (err) {
      console.warn('JQL search failed:', err);
    }
  }

  return results;
}

/**
 * Fetch all issue types (with their fields) for a project.
 * Result is cached in chrome.storage.local under `jirawm_createmeta_{projectKey}`.
 */
export async function getAssignableUsers(projectKey: string, query = ''): Promise<JiraUser[]> {
  const data = (await apiFetch(
    `/user/assignable/search?project=${encodeURIComponent(projectKey)}&query=${encodeURIComponent(query)}&maxResults=50`,
  )) as Array<{
    accountId: string;
    displayName: string;
    avatarUrls?: { '24x24'?: string };
    active: boolean;
  }>;

  return data
    .filter((u) => u.active)
    .map((u) => ({
      accountId: u.accountId,
      displayName: u.displayName,
      avatarUrls: { '24x24': u.avatarUrls?.['24x24'] ?? '' },
      active: u.active,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getIssueTypes(projectKey: string): Promise<IssueTypeMeta[]> {
  const cacheKey = `jirawm_createmeta_${projectKey}`;
  const cached = await getLocal<IssueTypeMeta[]>(cacheKey);
  if (cached) return cached;

  const data = (await apiFetch(
    `/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`,
  )) as {
    projects: Array<{
      issuetypes: Array<{ id: string; name: string; fields: Record<string, RawField> }>;
    }>;
  };

  const issuetypes = data.projects[0]?.issuetypes ?? [];
  const result: IssueTypeMeta[] = issuetypes.map((it) => ({
    id: it.id,
    name: it.name,
    fields: Object.entries(it.fields).map(([id, f]) => ({
      id,
      name: f.name,
      required: f.required,
      schema: { type: f.schema?.type ?? 'string', items: f.schema?.items },
      allowedValues: f.allowedValues?.map((v: RawAllowedValue) => ({
        id: v.id,
        value: v.value ?? v.name,
        name: v.name,
      })),
    })),
  }));

  await setLocal(cacheKey, result);
  return result;
}

export async function createIssue(params: {
  summary: string;
  projectKey: string;
  issueType: string;
  parentKey?: string;
  fields: Record<string, unknown>;
  fieldMeta: JiraField[];
  descriptionOptions?: {
    screenshots: ScreenshotItem[];
    position: MetadataPosition;
    captureDetailsSettings: CaptureDetailsSettings;
  };
}): Promise<{ id: string; key: string }> {
  const fields: Record<string, unknown> = {
    project: { key: params.projectKey },
    summary: params.summary,
    issuetype: { name: params.issueType },
    description: buildDescriptionField(params.fields['description'], params.descriptionOptions),
  };

  for (const [fieldId, value] of Object.entries(params.fields)) {
    if (fieldId === 'description') continue;
    fields[fieldId] =
      typeof value === 'string'
        ? serializeField(fieldId, value, params.fieldMeta)
        : value;
  }

  // Only send `parent` when a parent key is provided — Jira rejects an empty parent.
  if (params.parentKey && params.parentKey.trim()) {
    fields.parent = { key: params.parentKey.trim() };
  }

  const data = (await apiFetch('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })) as { id: string; key: string };

  return { id: data.id, key: data.key };
}

export async function attachScreenshot(
  issueKey: string,
  dataUrl: string,
  filename: string,
): Promise<{ id: string }> {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });

  const form = new FormData();
  form.append('file', blob, filename);

  const { email, apiToken } = requireAuth();
  const res = await fetch(`${baseUrl()}/issue/${issueKey}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${email}:${apiToken}`)}`,
      'X-Atlassian-Token': 'no-check',
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Attach screenshot failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as Array<{ id: string }>;
  return { id: data[0].id };
}

export function buildCommentADF(text: string): object {
  return toADF(text);
}

export async function addComment(issueKey: string, adfBody: object): Promise<{ id: string }> {
  const data = (await apiFetch(`/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: adfBody }),
  })) as { id: string };
  return { id: data.id };
}

export function buildCommentUrl(issueKey: string, commentId: string): string {
  const { domain } = requireAuth();
  return `https://${domain}.atlassian.net/browse/${issueKey}?focusedCommentId=${commentId}`;
}

export async function updateComment(issueKey: string, commentId: string, adfBody: object): Promise<void> {
  await apiFetch(`/issue/${issueKey}/comment/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ body: adfBody }),
  });
}

// Local types for raw Jira API shapes — not exported
interface RawAllowedValue {
  id: string;
  name: string;
  value?: string;
}

interface RawField {
  name: string;
  required: boolean;
  schema?: { type: string; items?: string };
  allowedValues?: RawAllowedValue[];
}
