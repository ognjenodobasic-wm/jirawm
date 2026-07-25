import type { BulkTask, Workflow, AuthConfig } from '../types';
import { getLocal, setLocal } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot, getIssueTypes } from '../lib/jira';

const BULK_PROGRESS_KEY = 'jirawm_bulk_progress';

let activeBulkRun: Promise<void> | null = null;

type BulkMessage = {
  type: 'START_BULK';
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
    handleStartBulk(msg.workflowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }
  return false;
});

// Resume any interrupted bulk session after worker restart
void guardedProcessBulkTasksWrapper();

async function guardedProcessBulkTasksWrapper(): Promise<void> {
  if (activeBulkRun) return;
  await resumeBulkIfNeeded();
}

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

async function resumeBulkIfNeeded(): Promise<void> {
  const [auth, workflows, progress] = await Promise.all([
    getLocal<AuthConfig>('auth'),
    getLocal<Workflow[]>('jirawm_workflows'),
    getLocal<BulkTask[]>(BULK_PROGRESS_KEY),
  ]);

  if (!auth || !progress || progress.length === 0) return;
  if (progress.every((t) => t.status === 'done' || t.status === 'failed')) return;

  setAuth(auth);

  const workflowId = progress[0]?.workflowId;
  if (!workflowId) return;
  const workflow = workflows?.find((w) => w.id === workflowId);
  if (!workflow) return;

  // Any 'creating' task without an issueKey is unsafe to auto-retry because the issue may
  // have already been created before the worker was killed. Mark it as failed so the user
  // can retry manually after confirming whether the issue exists.
  let changed = false;
  for (const task of progress) {
    if (task.status === 'creating' && !task.issueKey) {
      task.status = 'failed';
      task.error =
        'Bulk processing was interrupted while creating the Jira issue. Retry manually to avoid a possible duplicate.';
      changed = true;
    }
  }
  if (changed) {
    await saveProgress(progress);
  }

  await guardedProcessBulkTasks(progress, workflow);
}

async function processBulkTasks(progress: BulkTask[], workflow: Workflow): Promise<void> {
  await chrome.alarms.create('keepAlive', { periodInMinutes: 0.33 });

  let createdCount = 0;
  let failedCount = 0;

  for (let i = 0; i < progress.length; i++) {
    const task = progress[i];
    if (task.status === 'done' || task.status === 'failed') continue;

    try {
      if (task.status === 'uploading' && task.issueKey) {
        await attachScreenshot(task.issueKey, task.screenshotBase64, task.attachmentName ?? `${task.issueKey}-screenshot.jpg`);
        task.status = 'done';
        createdCount++;
        await saveProgress(progress);
        continue;
      }

      task.status = 'creating';
      await saveProgress(progress);

      const fields: Record<string, unknown> = buildWorkflowFields(workflow);
      if (task.description?.trim()) {
        fields.description = task.description.trim();
      }
      if (task.assignee) {
        fields.assignee = { accountId: task.assignee };
      }

      const issueTypes = await getIssueTypes(workflow.projectKey);
      const issueTypeMeta = issueTypes.find((it) => it.name === workflow.issueType);
      const fieldMeta = issueTypeMeta?.fields ?? [];

      const issue = await createIssue({
        summary: task.summary,
        projectKey: workflow.projectKey,
        issueType: workflow.issueType,
        parentKey: workflow.hasParent ? workflow.parentKey : undefined,
        fields,
        fieldMeta,
      });

      task.status = 'uploading';
      task.issueKey = issue.key;
      await saveProgress(progress);

      await attachScreenshot(issue.key, task.screenshotBase64, task.attachmentName ?? `${issue.key}-screenshot.jpg`);

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

async function guardedProcessBulkTasks(progress: BulkTask[], workflow: Workflow): Promise<void> {
  if (activeBulkRun) {
    await activeBulkRun;
    return;
  }

  activeBulkRun = (async () => {
    try {
      await processBulkTasks(progress, workflow);
    } finally {
      activeBulkRun = null;
    }
  })();

  await activeBulkRun;
}

async function handleStartBulk(workflowId: string): Promise<void> {
  if (activeBulkRun) {
    await activeBulkRun;
    return;
  }

  const [auth, workflows] = await Promise.all([
    getLocal<AuthConfig>('auth'),
    getLocal<Workflow[]>('jirawm_workflows'),
  ]);

  if (!auth) throw new Error('Jira auth not configured.');
  setAuth(auth);

  const workflow = workflows?.find((w) => w.id === workflowId);
  if (!workflow) throw new Error('Selected workflow not found.');

  const progress = (await getLocal<BulkTask[]>(BULK_PROGRESS_KEY)) ?? [];
  const taggedProgress = progress.map((task) =>
    task.workflowId === workflowId ? task : { ...task, workflowId },
  );
  await saveProgress(taggedProgress);

  await guardedProcessBulkTasks(taggedProgress, workflow);
}
