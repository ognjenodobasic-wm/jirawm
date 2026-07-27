import { useEffect, useState } from 'react';
import type { AuthConfig, ScreenshotItem, AppSettings, Workflow } from '../types';
import { getLocal, getAppSettings } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot, getIssueTypes } from '../lib/jira';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';
import AssigneeSelect from './components/AssigneeSelect';
import CaptureDetailsPreview from './single/CaptureDetailsPreview';
import ScreenshotStrip from './single/ScreenshotStrip';
import { useAnnotationEditor } from './single/useAnnotationEditor';
import { useScreenshotCapture } from './single/useScreenshotCapture';
import type { HistoryEntry, SingleModeProps } from './single/types';

export type { SingleTabState } from './single/types';

export default function SingleMode({ workflows, selectedWorkflowId, isAuthed, onOpenSettings, state, onStateChange }: SingleModeProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const { screenshots, selectedId, summary, assignee, description } = state;

  const setScreenshots = (next: ScreenshotItem[] | ((prev: ScreenshotItem[]) => ScreenshotItem[])) => {
    onStateChange((prev) => ({
      ...prev,
      screenshots: typeof next === 'function' ? next(prev.screenshots) : next,
    }));
  };

  const setSelectedId = (next: string | null | ((prev: string | null) => string | null)) => {
    onStateChange((prev) => ({
      ...prev,
      selectedId: typeof next === 'function' ? next(prev.selectedId) : next,
    }));
  };

  const setSummary = (next: string | ((prev: string) => string)) => {
    onStateChange((prev) => ({
      ...prev,
      summary: typeof next === 'function' ? next(prev.summary) : next,
    }));
  };

  const setAssignee = (next: string | null | ((prev: string | null) => string | null)) => {
    onStateChange((prev) => ({
      ...prev,
      assignee: typeof next === 'function' ? next(prev.assignee) : next,
    }));
  };

  const setDescription = (next: string | ((prev: string) => string)) => {
    onStateChange((prev) => ({
      ...prev,
      description: typeof next === 'function' ? next(prev.description) : next,
    }));
  };

  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [attachFailed, setAttachFailed] = useState(false);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  useEffect(() => {
    getAppSettings().then(setAppSettings);
  }, []);

  const {
    fileInputRef,
    capturePermission,
    permissionMessage,
    handleCapture,
    handleFileSelect,
    handleRemove: removeScreenshot,
    resetCounter,
  } = useScreenshotCapture({
    screenshots,
    setScreenshots,
    setSelectedId,
    setResultKey,
    setAttachFailed,
    setError,
    activeWorkflow,
    appSettings,
  });

  const { openEditor } = useAnnotationEditor({ screenshots, setScreenshots, appSettings });

  function handleRemove(id: string) {
    removeScreenshot(id);
    if (selectedId === id) setSelectedId(null);
  }

  useEffect(() => {
    const wf = workflows.find((w) => w.id === selectedWorkflowId) ?? null;
    setActiveWorkflow(wf);
    setSummary('');
    setAssignee(wf?.defaultAssignee ?? null);
    setDescription(wf?.requiredFieldDefaults.description ?? '');
    setScreenshots([]);
    setSelectedId(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
    resetCounter();
  }, [workflows, selectedWorkflowId]); // eslint-disable-line react-hooks/exhaustive-deps — setSummary, setDescription, etc. are wrapper functions around the parent's stable onStateChange dispatcher; listing them would cause the effect to fire every render

  function resetForm() {
    setSummary('');
    setAssignee(activeWorkflow?.defaultAssignee ?? null);
    setDescription(activeWorkflow?.requiredFieldDefaults.description ?? '');
    setScreenshots([]);
    setSelectedId(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
    setShowSuccess(false);
    resetCounter();
  }

  function truncateSummary(text: string, max = 45): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max)}…`;
  }

  function addToHistory(key: string, taskSummary: string, taskDomain: string) {
    const entry: HistoryEntry = {
      key,
      summary: truncateSummary(taskSummary),
      url: `https://${taskDomain}.atlassian.net/browse/${key}`,
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.key !== key)];
      return next.slice(0, 10);
    });
  }

  async function retryFailedAttachments() {
    if (!resultKey || failedIndices.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) throw new Error('Jira credentials not configured.');
      setAuth(auth);

      const stillFailed: number[] = [];
      let successCount = 0;
      for (const idx of failedIndices) {
        const item = screenshots[idx];
        if (!item) continue;
        try {
          await attachScreenshot(resultKey, item.dataUrl, item.filename);
          successCount++;
        } catch {
          stillFailed.push(idx);
        }
      }

      if (stillFailed.length === 0) {
        setAttachFailed(false);
        setFailedIndices([]);
        setError(null);
      } else {
        setFailedIndices(stillFailed);
        setError(`${successCount}/${failedIndices.length} retried screenshots uploaded`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultKey(null);

    if (!activeWorkflow) {
      setError('No workflow selected. Create one with "+ New".');
      return;
    }
    if (!summary.trim()) {
      setError('Summary is required.');
      return;
    }
    if (screenshots.length === 0) {
      setError('Please capture at least one screenshot.');
      return;
    }

    setIsLoading(true);

    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) {
        throw new Error('Jira credentials not configured. Open Settings first.');
      }
      setAuth(auth);
      setDomain(auth.domain);

      const position = appSettings?.captureDetails.position ?? 'bottom';
      const detailsSettings = appSettings?.captureDetails ?? {
        enabled: true,
        position: 'bottom',
        includeUrl: true,
        includePageTitle: true,
        includeTimestamp: true,
        includeViewport: true,
        includeBrowser: true,
        stripQueryParams: true,
        allowPerScreenshotEdit: true,
      };
      const fields: Record<string, unknown> = {
        ...buildWorkflowFields(activeWorkflow),
        description: description.trim(),
      };

      if (assignee) {
        fields.assignee = { accountId: assignee };
      }

      const issueTypes = await getIssueTypes(activeWorkflow.projectKey);
      const issueTypeMeta = issueTypes.find((it) => it.name === activeWorkflow.issueType);
      const fieldMeta = issueTypeMeta?.fields ?? [];

      const issue = await createIssue({
        summary: summary.trim(),
        projectKey: activeWorkflow.projectKey,
        issueType: activeWorkflow.issueType,
        parentKey: activeWorkflow.hasParent ? activeWorkflow.parentKey : undefined,
        fields,
        fieldMeta,
        descriptionOptions: {
          screenshots,
          position,
          captureDetailsSettings: detailsSettings,
        },
      });

      let uploadedCount = 0;
      const next: ScreenshotItem[] = [];
      const newFailedIndices: number[] = [];
      for (let i = 0; i < screenshots.length; i++) {
        const item = screenshots[i];
        try {
          await attachScreenshot(issue.key, item.dataUrl, item.filename);
          uploadedCount++;
          next.push({ ...item });
        } catch {
          newFailedIndices.push(i);
          next.push({ ...item });
        }
      }
      setScreenshots(next);

      if (uploadedCount < screenshots.length) {
        setResultKey(issue.key);
        setAttachFailed(true);
        setFailedIndices(newFailedIndices);
        setError(`${uploadedCount}/${screenshots.length} screenshots uploaded`);
      } else {
        const createdKey = issue.key;
        const createdSummary = summary.trim();
        setResultKey(createdKey);
        setAttachFailed(false);
        setFailedIndices([]);
        setError(null);
        setShowSuccess(true);
        addToHistory(createdKey, createdSummary, auth.domain);
        setTimeout(() => setShowSuccess(false), 3000);
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--chrome-border)',
    borderRadius: '4px',
    padding: '4px 6px',
    fontSize: '12px',
    background: 'var(--chrome-bg)',
    color: 'var(--chrome-text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--chrome-text-secondary)',
    marginBottom: '2px',
  };

  const hasMetadata = screenshots.some((s) => s.metadata !== null);

  if (!isAuthed) {
    return <ConnectJiraPrompt onOpenSettings={onOpenSettings} />;
  }

  if (workflows.length === 0 || !selectedWorkflowId || !activeWorkflow) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 p-3 text-center"
        style={{ minHeight: '200px' }}
      >
        <p className="text-sm" style={{ color: 'var(--chrome-text-secondary)' }}>
          Select or create a workflow to get started
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {activeWorkflow && (
        <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          {activeWorkflow.hasParent && activeWorkflow.parentKey
            ? `${activeWorkflow.projectKey} → under ${activeWorkflow.parentKey} → ${activeWorkflow.issueType}`
            : `${activeWorkflow.projectKey} → ${activeWorkflow.issueType}`}
        </div>
      )}

      <ScreenshotStrip
        screenshots={screenshots}
        selectedId={selectedId}
        isLoading={isLoading}
        capturePermission={capturePermission}
        fileInputRef={fileInputRef}
        onCapture={() => { void handleCapture(); }}
        onFileSelect={handleFileSelect}
        onOpenEditor={(index) => { void openEditor(index); }}
        onRemove={(id) => setPendingRemoveId(id)}
        onOpenSettings={onOpenSettings}
      />

      {permissionMessage && (
        <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          {permissionMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label style={labelStyle}>Summary *</label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isLoading}
            style={inputStyle}
            placeholder="Subtask summary"
          />
        </div>

        <div>
          <label style={labelStyle}>Assignee</label>
          <AssigneeSelect
            projectKey={activeWorkflow?.projectKey ?? ''}
            value={assignee}
            onChange={setAssignee}
            disabled={isLoading}
          />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Optional description"
          />
        </div>

        {hasMetadata && (
          <CaptureDetailsPreview screenshots={screenshots} />
        )}

        {error && (
          <div
            className="rounded p-2 text-xs"
            style={{ background: 'rgba(217, 48, 37, 0.1)', color: 'var(--chrome-red)' }}
          >
            {error}
          </div>
        )}

        {showSuccess && resultKey && !attachFailed && (
          <div
            className="rounded p-2 text-xs"
            style={{ background: 'rgba(30, 142, 62, 0.1)', color: 'var(--chrome-green)' }}
          >
            Created{' '}
            <a
              href={`https://${domain}.atlassian.net/browse/${resultKey}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'underline', fontWeight: 600 }}
            >
              {resultKey}
            </a>
          </div>
        )}

        {resultKey && attachFailed && (
          <div
            className="rounded p-2 text-xs space-y-2"
            style={{ background: 'rgba(251, 188, 5, 0.1)', color: 'var(--chrome-text-primary)' }}
          >
            <div>
              ⚠️{' '}
              <a
                href={`https://${domain}.atlassian.net/browse/${resultKey}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'underline', fontWeight: 600 }}
              >
                {resultKey}
              </a>{' '}
              — screenshot upload failed
            </div>
            <button
              type="button"
              onClick={retryFailedAttachments}
              disabled={isLoading}
              className="w-full rounded py-1 px-2 text-xs font-medium"
              style={{
                border: 'none',
            background: 'var(--chrome-blue)',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Retrying…' : `Retry screenshots (${failedIndices.length})`}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !!resultKey}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-green)',
            color: '#fff',
            cursor: isLoading || !!resultKey ? 'not-allowed' : 'pointer',
            opacity: isLoading || !!resultKey ? 0.6 : 1,
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
              Creating…
            </span>
          ) : activeWorkflow ? `Create ${activeWorkflow.issueType}` : 'Create Task'}
        </button>

        {history.length > 0 && (
          <div className="space-y-1">
            <span
              className="text-xs font-semibold"
              style={{
                color: 'var(--chrome-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              Recent
            </span>
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid var(--chrome-border)',
                borderRadius: 4,
                padding: '4px 6px',
              }}
            >
              {history.map((entry) => (
                <div key={entry.key} className="text-xs py-0.5">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--chrome-blue)', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    {entry.key}
                  </a>
                  <span style={{ color: 'var(--chrome-text-secondary)' }}> — {entry.summary}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {pendingRemoveId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--chrome-bg)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 8,
              padding: 20,
              minWidth: 280,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--chrome-text-primary)', margin: '0 0 16px' }}>
              Remove this screenshot? This can't be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setPendingRemoveId(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid var(--chrome-border)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRemove(pendingRemoveId);
                  setPendingRemoveId(null);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--chrome-red)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
