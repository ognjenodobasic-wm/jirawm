import type { AuthConfig, JiraField } from '../types';
import { getSync, setSync } from './storage';

let _auth: AuthConfig | null = null;

export function setAuth(config: AuthConfig): void {
  _auth = config;
}

function requireAuth(): AuthConfig {
  if (!_auth) throw new Error('Jira auth not configured. Call setAuth() first.');
  return _auth;
}

export function getHeaders(): HeadersInit {
  const { email, apiToken } = requireAuth();
  return {
    Authorization: `Basic ${btoa(`${email}:${apiToken}`)}`,
    'Content-Type': 'application/json',
  };
}

function baseUrl(): string {
  return `https://${requireAuth().domain}/rest/api/3`;
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

export async function testConnection(): Promise<{ accountId: string; displayName: string }> {
  const data = (await apiFetch('/myself')) as { accountId: string; displayName: string };
  return { accountId: data.accountId, displayName: data.displayName };
}

export async function getProjects(): Promise<Array<{ key: string; name: string }>> {
  const data = (await apiFetch('/project/search?maxResults=100')) as {
    values: Array<{ key: string; name: string }>;
  };
  return data.values.map(({ key, name }) => ({ key, name }));
}

export async function getCreateMeta(
  projectKey: string,
  issueType: string,
): Promise<{ requiredFields: JiraField[]; optionalFields: JiraField[] }> {
  const data = (await apiFetch(
    `/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueType)}&expand=projects.issuetypes.fields`,
  )) as {
    projects: Array<{
      issuetypes: Array<{ fields: Record<string, RawField> }>;
    }>;
  };

  const fields = data.projects[0]?.issuetypes[0]?.fields ?? {};
  const requiredFields: JiraField[] = [];
  const optionalFields: JiraField[] = [];

  for (const [id, f] of Object.entries(fields)) {
    const field: JiraField = {
      id,
      name: f.name,
      required: f.required,
      schema: { type: f.schema?.type ?? 'string' },
      allowedValues: f.allowedValues?.map((v: RawAllowedValue) => ({
        id: v.id,
        name: v.name,
        value: v.value,
      })),
    };
    (f.required ? requiredFields : optionalFields).push(field);
  }

  return { requiredFields, optionalFields };
}

export async function createIssue(params: {
  summary: string;
  projectKey: string;
  issueType: string;
  parentKey: string;
  fields: Record<string, unknown>;
}): Promise<{ id: string; key: string }> {
  const body = {
    fields: {
      ...params.fields,
      project: { key: params.projectKey },
      summary: params.summary,
      issuetype: { name: params.issueType },
      parent: { key: params.parentKey },
      description: toADF(
        typeof params.fields['description'] === 'string'
          ? params.fields['description']
          : '',
      ),
    },
  };

  const data = (await apiFetch('/issue', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { id: string; key: string };

  return { id: data.id, key: data.key };
}

export async function fetchCreatemeta(
  projectKey: string,
  issueType: string,
): Promise<{ requiredFields: JiraField[]; optionalFields: JiraField[] }> {
  const cacheKey = `jirawm_createmeta_${projectKey}_${issueType}`;
  const cached = await getSync<{ requiredFields: JiraField[]; optionalFields: JiraField[] }>(cacheKey);
  if (cached) return cached;
  const result = await getCreateMeta(projectKey, issueType);
  await setSync(cacheKey, result);
  return result;
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
  schema?: { type: string };
  allowedValues?: RawAllowedValue[];
}
