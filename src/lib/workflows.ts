import type { Workflow, ExportSnapshot } from '../types';
import { getSync, setSync } from './storage';

const WORKFLOWS_KEY = 'jirawm_workflows';
const SNAPSHOT_KEY = 'jirawm_export_snapshot';

export async function getWorkflows(): Promise<Workflow[]> {
  return (await getSync<Workflow[]>(WORKFLOWS_KEY)) ?? [];
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const existing = await getWorkflows();
  const idx = existing.findIndex((w) => w.id === workflow.id);
  if (idx >= 0) {
    existing[idx] = workflow;
  } else {
    existing.push(workflow);
  }
  await setSync(WORKFLOWS_KEY, existing);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const existing = await getWorkflows();
  await setSync(
    WORKFLOWS_KEY,
    existing.filter((w) => w.id !== id),
  );
}

export async function getExportSnapshot(): Promise<ExportSnapshot | null> {
  return getSync<ExportSnapshot>(SNAPSHOT_KEY);
}

export async function exportWorkflows(): Promise<void> {
  const workflows = await getWorkflows();

  const json = JSON.stringify(workflows, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `jirawm-workflows-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const snapshot: ExportSnapshot = {
    timestamp: new Date().toISOString(),
    count: workflows.length,
    names: workflows.map((w) => w.name),
  };
  await setSync(SNAPSHOT_KEY, snapshot);
}

export async function importWorkflows(file: File): Promise<void> {
  const text = await file.text();
  const imported: unknown = JSON.parse(text);

  if (!Array.isArray(imported)) {
    throw new Error('Invalid workflow file: expected a JSON array.');
  }

  const existing = await getWorkflows();
  const merged = [...existing];

  for (const item of imported) {
    const w = item as Workflow;
    if (!w.id || !w.name) {
      throw new Error(`Invalid workflow entry: missing id or name.`);
    }
    const idx = merged.findIndex((e) => e.id === w.id);
    if (idx >= 0) {
      merged[idx] = w;
    } else {
      merged.push(w);
    }
  }

  await setSync(WORKFLOWS_KEY, merged);
}
