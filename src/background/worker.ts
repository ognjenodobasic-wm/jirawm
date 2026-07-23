import type { BulkTask, Workflow, AuthConfig } from '../types';
import { getLocal, getSync, setLocal } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot } from '../lib/jira';

function toADF(text: string): object {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

const BULK_PROGRESS_KEY = 'jirawm_bulk_progress';

type BulkMessage = {
  type: 'START_BULK';
  tasks: BulkTask[];
  workflowId: string;
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('JiraWM installed.');
});

chrome.action.onClicked.addListener((tab) => {
  if (tab?.windowId == null) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as BulkMessage;
  if (msg.type === 'START_BULK') {
    processBulkTasks(msg.tasks, msg.workflowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener(() => {
  chrome.windows.getCurrent().then((window) => {
    if (window?.id != null) {
      chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
    }
  });
});

async function saveProgress(tasks: BulkTask[]): Promise<void> {
  await setLocal(BULK_PROGRESS_KEY, tasks);
}

async function processBulkTasks(tasks: BulkTask[], workflowId: string): Promise<void> {
  const [auth, workflows] = await Promise.all([
    getLocal<AuthConfig>('auth'),
    getSync<Workflow[]>('jirawm_workflows'),
  ]);

  if (!auth) throw new Error('Jira auth not configured.');
  setAuth(auth);

  const workflow = workflows?.find((w) => w.id === workflowId);
  if (!workflow) throw new Error('Selected workflow not found.');

  await chrome.alarms.create('keepAlive', { periodInMinutes: 0.33 });

  const existing = (await getLocal<BulkTask[]>(BULK_PROGRESS_KEY)) ?? [];
  const merged = [...existing];
  for (const task of tasks) {
    const idx = merged.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      merged[idx] = { ...task };
    } else {
      merged.push({ ...task });
    }
  }
  const progress: BulkTask[] = merged;
  await saveProgress(progress);

  let createdCount = 0;
  let failedCount = 0;

  for (let i = 0; i < progress.length; i++) {
    const task = progress[i];
    if (task.status === 'done') continue;

    try {
      task.status = 'creating';
      await saveProgress(progress);

      const fields: Record<string, unknown> = buildWorkflowFields(workflow);
      if (task.description?.trim()) {
        fields.description = toADF(task.description.trim());
      }

      const issue = await createIssue({
        summary: task.summary,
        projectKey: workflow.projectKey,
        issueType: workflow.issueType,
        parentKey: workflow.hasParent ? workflow.parentKey : undefined,
        fields,
        fieldMeta: workflow.fieldMeta,
      });

      task.status = 'uploading';
      task.issueKey = issue.key;
      await saveProgress(progress);

      await attachScreenshot(issue.key, task.screenshotBase64, `${issue.key}-screenshot.jpg`);

      task.status = 'done';
      createdCount++;
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
      failedCount++;
    }
    await saveProgress(progress);
  }

  await chrome.alarms.clear('keepAlive');

  const notificationMessage =
    failedCount > 0
      ? `${createdCount}/${progress.length} tasks created — ${failedCount} failed`
      : `${createdCount}/${progress.length} tasks created ✅`;

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'JiraWM Bulk Upload',
    message: notificationMessage,
  });
}
