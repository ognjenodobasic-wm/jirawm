import type { Workflow } from '../types';
import { getSync, setSync } from './storage';

const WORKFLOWS_KEY = 'jirawm_workflows';
const SNAPSHOT_KEY = 'jirawm_export_snapshot';

export { WORKFLOWS_KEY, SNAPSHOT_KEY };

export function buildWorkflowFields(workflow: Workflow): Record<string, string> {
  const fields: Record<string, string> = { ...workflow.requiredFieldDefaults };
  for (const f of workflow.optionalFields) {
    if (f.defaultValue !== undefined) fields[f.fieldId] = f.defaultValue;
  }
  return fields;
}

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
