import { useEffect, useRef, useState } from 'react';
import type { AuthConfig, Workflow, ScreenshotItem, WindowBounds, AnnotationResult, AppSettings, NamingSettings } from '../types';
import { getLocal, setLocal, getAppSettings } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot, getIssueTypes } from '../lib/jira';
import { normalizeImage, readImageSize, toJpegFilename } from '../lib/image';
import { collectCaptureMetadata } from '../lib/capture-metadata';
import { buildDescriptionADF, buildCaptureDetailLines } from '../lib/capture-adf';
import { hasCapturePermission, requestCapturePermission } from '../lib/permissions';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';
import AssigneeSelect from './components/AssigneeSelect';
import Tooltip from './components/Tooltip';

interface HistoryEntry {
  key: string;
  summary: string;
  url: string;
}

interface SingleModeProps {
  workflows: Workflow[];
  selectedWorkflowId: string;
  isAuthed: boolean;
  onOpenSettings: () => void;
}

const MAX_SCREENSHOTS = 10;

async function readEditorBounds(): Promise<WindowBounds | null> {
  return getLocal<WindowBounds>('editorWindowBounds');
}

function buildImageSettings(app: AppSettings | null, workflow: Workflow | null) {
  const quality = workflow?.compression.quality ?? app?.image.quality ?? 0.85;
  const maxWidth = workflow?.compression.maxWidth ?? app?.image.maxWidth ?? 1920;
  const transparencyFill = app?.image.transparencyFill ?? 'white';
  return { quality, maxWidth, transparencyFill };
}

export default function SingleMode({ workflows, selectedWorkflowId, isAuthed, onOpenSettings }: SingleModeProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [attachFailed, setAttachFailed] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [naming, setNaming] = useState<NamingSettings>({ numberSingleScreenshots: true, numberBulkFiles: true });
  const [editorWindowId, setEditorWindowId] = useState<number | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [capturePermission, setCapturePermission] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const counterRef = useRef(1);

  // Cleanup stale editor data from previous sessions
  useEffect(() => {
    chrome.storage.local.remove(['pendingEditor', 'annotationResult']);
  }, []);

  useEffect(() => {
    getAppSettings().then((settings) => {
      setAppSettings(settings);
      setNaming(settings.naming);
    });
  }, []);

  useEffect(() => {
    const listener = (msg: Record<string, unknown>): void => {
      if (msg.type === 'ANNOTATION_DONE') {
        chrome.storage.local.get('annotationResult', (result) => {
          if (result['annotationResult']) {
            const { dataUrl, screenshotId } = result['annotationResult'] as AnnotationResult;
            setScreenshots((prev) => {
              const exists = prev.some((s) => s.id === screenshotId);
              if (!exists) {
                // Screenshot was deleted while editor was open; discard result silently.
                return prev;
              }
              return prev.map((s) => (s.id === screenshotId ? { ...s, dataUrl, annotated: true } : s));
            });
            chrome.storage.local.remove(['pendingEditor', 'annotationResult']);
          }
          setEditorWindowId(null);
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Clear stale editorWindowId when user closes the popup manually
  useEffect(() => {
    function handleWindowRemoved(windowId: number) {
      setEditorWindowId((prev) => (prev === windowId ? null : prev));
    }
    chrome.windows.onRemoved.addListener(handleWindowRemoved);
    return () => chrome.windows.onRemoved.removeListener(handleWindowRemoved);
  }, []);

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
    counterRef.current = 1;
  }, [workflows, selectedWorkflowId]);

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
    counterRef.current = 1;
  }

  async function openEditor(index: number) {
    if (editorWindowId !== null) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.windows.update(editorWindowId, { focused: true }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          });
        });
        return;
      } catch {
        setEditorWindowId(null);
      }
    }
    const screenshot = screenshots[index];
    if (!screenshot) return;
    await setLocal('pendingEditor', {
      dataUrl: screenshot.dataUrl,
      screenshotId: screenshot.id,
    });
    const bounds = await readEditorBounds();
    const createData: chrome.windows.CreateData = {
      type: 'popup',
      url: chrome.runtime.getURL('editor.html'),
      width: bounds?.width ?? 1000,
      height: bounds?.height ?? 700,
    };
    if (bounds?.left != null) createData.left = bounds.left;
    if (bounds?.top != null) createData.top = bounds.top;
    chrome.windows.create(createData, (win) => {
      setEditorWindowId(win?.id ?? null);
    });
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

  useEffect(() => {
    hasCapturePermission().then(setCapturePermission).catch(() => setCapturePermission(false));
  }, []);

  // Re-check permission when the panel becomes visible again.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        hasCapturePermission().then(setCapturePermission).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  async function handleCapture() {
    if (isLoading || screenshots.length >= MAX_SCREENSHOTS) return;
    setPermissionMessage(null);

    // Request permission synchronously from the click. Calling request when already granted
    // resolves true immediately without showing a prompt. This must be the first awaited call
    // after the click so Chrome accepts it.
    if (capturePermission !== true) {
      const granted = await requestCapturePermission();
      setCapturePermission(granted);
      if (!granted) {
        setPermissionMessage(
          'Screenshot capture needs permission to read the current page. Use Add to upload an image instead, or click Capture again to grant it.',
        );
        return;
      }
    }

    try {
      setError(null);
      const settings = appSettings;
      const imageSettings = buildImageSettings(settings, activeWorkflow);
      const tab = await chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] ?? null);
      const tabId = tab?.id ?? -1;

      // Capture lossless PNG so normalizeImage performs the only JPEG compression step.
      const rawDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      const { width: rawWidth, height: rawHeight } = await readImageSize(rawDataUrl);

      const metadata =
        tabId >= 0 && settings
          ? await collectCaptureMetadata(tabId, rawWidth, rawHeight, settings.captureDetails)
          : null;

      const { dataUrl } = await normalizeImage(rawDataUrl, imageSettings);

      const number = naming.numberSingleScreenshots ? counterRef.current++ : null;
      const filename = number !== null ? `${number}.jpg` : toJpegFilename('screenshot.jpg');

      const item: ScreenshotItem = {
        id: crypto.randomUUID(),
        dataUrl,
        origin: 'capture',
        number,
        filename,
        metadata,
      };
      setScreenshots((prev) => [...prev, item]);
      setSelectedId(item.id);
      setResultKey(null);
      setAttachFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) return;
    const accepted = imageFiles.slice(0, remaining);
    const skipped = imageFiles.length - accepted.length;
    const imageSettings = buildImageSettings(appSettings, activeWorkflow);

    for (const file of accepted) {
      try {
        const { dataUrl } = await normalizeImage(file, imageSettings);
        const number = naming.numberSingleScreenshots ? counterRef.current++ : null;
        const filename = number !== null ? `${number}.jpg` : toJpegFilename(file.name);
        const item: ScreenshotItem = {
          id: crypto.randomUUID(),
          dataUrl,
          origin: 'upload',
          number,
          filename,
          metadata: null,
        };
        setScreenshots((prev) => [...prev, item]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    if (skipped > 0) {
      setError(`Only ${MAX_SCREENSHOTS} screenshots per task — ${skipped} file${skipped === 1 ? '' : 's'} were skipped.`);
    }
    setResultKey(null);
    setAttachFailed(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleRemove(id: string) {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function retryFailedAttachments() {
    if (!resultKey || screenshots.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) throw new Error('Jira credentials not configured.');
      setAuth(auth);

      const next: ScreenshotItem[] = [];
      for (const item of screenshots) {
        try {
          await attachScreenshot(resultKey, item.dataUrl, item.filename);
          next.push({ ...item });
        } catch (attachErr) {
          next.push({ ...item });
          throw attachErr;
        }
      }
      setScreenshots(next);
      setAttachFailed(false);
      setError(null);
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
      };
      const descriptionADF = buildDescriptionADF(description.trim(), screenshots, position, detailsSettings);

      const fields: Record<string, unknown> = {
        ...buildWorkflowFields(activeWorkflow),
        description: descriptionADF,
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
      });

      let uploadedCount = 0;
      const next: ScreenshotItem[] = [];
      for (const item of screenshots) {
        try {
          await attachScreenshot(issue.key, item.dataUrl, item.filename);
          uploadedCount++;
          next.push({ ...item });
        } catch {
          next.push({ ...item });
        }
      }
      setScreenshots(next);

      if (uploadedCount < screenshots.length) {
        setResultKey(issue.key);
        setAttachFailed(true);
        setError(`${uploadedCount}/${screenshots.length} screenshots uploaded`);
      } else {
        const createdKey = issue.key;
        const createdSummary = summary.trim();
        setResultKey(createdKey);
        setAttachFailed(false);
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

  // Scroll fade affordance
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function updateFade() {
      if (!el) return;
      setShowFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }
    updateFade();
    el.addEventListener('scroll', updateFade);
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro.disconnect();
    };
  }, [screenshots.length]);

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
            ? `${activeWorkflow.projectKey} · under ${activeWorkflow.parentKey} · ${activeWorkflow.issueType}`
            : `${activeWorkflow.projectKey} · ${activeWorkflow.issueType}`}
        </div>
      )}

      {/* Screenshot card */}
      <div
        style={{
          border: '1px solid var(--chrome-border)',
          borderRadius: 8,
          background: 'var(--chrome-bg)',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--chrome-border)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--chrome-text-primary)' }}>
              Screenshots
            </span>
            <span
              style={{
                fontSize: 11,
                color: screenshots.length >= MAX_SCREENSHOTS ? 'var(--chrome-red)' : 'var(--chrome-text-secondary)',
              }}
            >
              ({screenshots.length}/{MAX_SCREENSHOTS})
            </span>
            <Tooltip text="Up to 10 per task. Screenshots you capture here also record the page URL, viewport and browser. Files you add from disk do not." />
          </div>
          <div className="flex items-center gap-2">
            {capturePermission === false ? (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--chrome-text-secondary)' }}>
                Screenshot dozvola nije odobrena.
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-xs"
                  style={{
                    color: 'var(--chrome-blue)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Podesi u opcijama ekstenzije
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'var(--chrome-blue)',
                  color: '#fff',
                  cursor: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 'not-allowed' : 'pointer',
                  opacity: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 0.5 : 1,
                }}
              >
                Capture
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--chrome-border)',
                background: 'transparent',
                color: 'var(--chrome-text-primary)',
                cursor: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 'not-allowed' : 'pointer',
                opacity: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 0.5 : 1,
              }}
            >
              Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: 8,
              padding: 8,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--chrome-border) transparent',
            }}
          >
            {screenshots.length === 0 && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--chrome-text-secondary)',
                  padding: '12px 0',
                }}
              >
                No screenshots yet — capture the page or add a file.
              </div>
            )}
            {screenshots.map((item, index) => (
              <div
                key={item.id}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
              >
                <div
                  onClick={() => { void openEditor(index); }}
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    borderRadius: 4,
                    border: `2px solid ${selectedId === item.id ? 'var(--chrome-blue)' : 'transparent'}`,
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={item.dataUrl}
                    alt="Screenshot thumbnail"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, pointerEvents: 'none' }}
                  />
                  {item.annotated && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 10,
                        padding: '2px 5px',
                        borderRadius: 3,
                        pointerEvents: 'none',
                      }}
                    >
                      ✎
                    </div>
                  )}
                  {item.number !== null && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 10,
                        padding: '2px 5px',
                        borderRadius: 3,
                        pointerEvents: 'none',
                      }}
                    >
                      {item.number}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                    aria-label="Remove screenshot"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 16,
                      height: 16,
                      background: 'var(--chrome-red)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      fontSize: 10,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          {showFade && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 24,
                background: 'linear-gradient(to right, transparent, var(--chrome-bg))',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

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
              {isLoading ? 'Retrying…' : 'Retry screenshots'}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !!resultKey}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-blue)',
            color: '#fff',
            cursor: isLoading || !!resultKey ? 'not-allowed' : 'pointer',
            opacity: isLoading || !!resultKey ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Creating…' : activeWorkflow ? `Create ${activeWorkflow.issueType}` : 'Create Task'}
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
    </div>
  );
}

function CaptureDetailsPreview({ screenshots }: { screenshots: ScreenshotItem[] }) {
  const [open, setOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const captureCount = screenshots.filter((s) => s.metadata !== null).length;

  useEffect(() => {
    getAppSettings().then(setAppSettings);
  }, []);

  if (captureCount === 0 || !appSettings) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--chrome-text-secondary)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>
          ▼
        </span>
        Capture details — {captureCount} screenshot{captureCount === 1 ? '' : 's'}
        <Tooltip text="These details are not part of the text above. They are generated from the screenshots and merged into the description when the task is created." />
      </button>
      {open && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--chrome-text-secondary)', lineHeight: 1.4 }}>
          {screenshots
            .filter((s): s is ScreenshotItem & { metadata: NonNullable<ScreenshotItem['metadata']> } => s.metadata !== null)
            .map((s) => {
              const lines = buildCaptureDetailLines(s, appSettings.captureDetails);
              return (
                <div key={s.id}>
                  <div style={{ fontWeight: 500, color: 'var(--chrome-text-primary)' }}>{s.filename}</div>
                  {lines.map((line) => <div key={line}>{line}</div>)}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
