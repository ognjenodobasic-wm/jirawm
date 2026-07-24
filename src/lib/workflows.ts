import type { Workflow } from '../types';
import { getLocal, setLocal } from './storage';

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
  return (await getLocal<Workflow[]>(WORKFLOWS_KEY)) ?? [];
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const existing = await getWorkflows();
  const idx = existing.findIndex((w) => w.id === workflow.id);

  // Strip fieldMeta before persistence — it is cached separately via createmeta.
  const workflowToSave = { ...workflow };
  delete workflowToSave.fieldMeta;

  if (idx >= 0) {
    existing[idx] = workflowToSave;
  } else {
    existing.push(workflowToSave);
  }
  await setLocal(WORKFLOWS_KEY, existing);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const existing = await getWorkflows();
  await setLocal(
    WORKFLOWS_KEY,
    existing.filter((w) => w.id !== id),
  );
}

/** One-time cleanup: remove workflows from chrome.storage.sync to free quota. */
export function removeLegacySyncWorkflows(): void {
  void chrome.storage.sync.remove(WORKFLOWS_KEY);
}
