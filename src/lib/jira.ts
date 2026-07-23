import type { AuthConfig, IssueTypeMeta, JiraField } from '../types';
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

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira ${res.status} ${res.statusText}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

function toADF(text: string): object {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
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
  const data = (await apiFetch('/project')) as Array<{ id: string; key: string; name: string }>;
  return data.map(({ id, key, name }) => ({ id, key, name }));
}

export async function searchIssues(
  query: string,
  projectId: string,
): Promise<Array<{ key: string; summary: string }>> {
  const searchQuery = query.toLowerCase();
  const data = (await apiFetch(
    `/issue/picker?query=${encodeURIComponent(searchQuery)}&currentProjectId=${encodeURIComponent(projectId)}&showSubTasks=false`,
  )) as {
    sections: Array<{
      issues?: Array<{ key: string; summaryText?: string; summary?: string }>;
    }>;
  };

  const results: Array<{ key: string; summary: string }> = [];
  for (const section of data.sections ?? []) {
    for (const issue of section.issues ?? []) {
      results.push({
        key: issue.key,
        summary: issue.summaryText ?? issue.summary ?? '',
      });
    }
  }
  return results;
}

/**
 * Fetch all issue types (with their fields) for a project.
 * Result is cached in chrome.storage.local under `jirawm_createmeta_{projectKey}`.
 */
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
}): Promise<{ id: string; key: string }> {
  const fields: Record<string, unknown> = {
    project: { key: params.projectKey },
    summary: params.summary,
    issuetype: { name: params.issueType },
    description: toADF(
      typeof params.fields['description'] === 'string' ? params.fields['description'] : '',
    ),
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
): Promise<void> {
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
