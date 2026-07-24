import { useEffect, useRef, useState, useCallback } from 'react';
import type { AuthConfig, Workflow, CompressionSettings, ScreenshotItem } from '../types';
import { getLocal } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot } from '../lib/jira';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';
import AssigneeSelect from './components/AssigneeSelect';

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

function resizeImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const width = Math.round(img.naturalWidth * scale);
      const height = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });
}

const MAX_SCREENSHOTS = 10;

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [globalCompression, setGlobalCompression] = useState<CompressionSettings>({ quality: 0.85, maxWidth: 1920 });

  useEffect(() => {
    getLocal<CompressionSettings>('jirawm_compression').then((c) => {
      if (c) setGlobalCompression(c);
    });
  }, []);

  useEffect(() => {
    const wf = workflows.find((w) => w.id === selectedWorkflowId) ?? null;
    setActiveWorkflow(wf);
    setSummary('');
    setAssignee(wf?.defaultAssignee ?? null);
    setDescription(wf?.requiredFieldDefaults.description ?? '');
    setScreenshots([]);
    setSelectedId(null);
    setSelectedIndex(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
  }, [workflows, selectedWorkflowId]);

  function resetForm() {
    setSummary('');
    setAssignee(activeWorkflow?.defaultAssignee ?? null);
    setDescription(activeWorkflow?.requiredFieldDefaults.description ?? '');
    setScreenshots([]);
    setSelectedId(null);
    setSelectedIndex(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
    setShowSuccess(false);
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

  async function handleCapture() {
    if (isLoading || screenshots.length >= MAX_SCREENSHOTS) return;
    try {
      setError(null);
      const quality = activeWorkflow?.compression.quality ?? globalCompression.quality ?? 0.85;
      const maxWidth = activeWorkflow?.compression.maxWidth ?? globalCompression.maxWidth ?? 1920;
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'jpeg',
        quality: Math.round(quality * 100),
      });
      const resized = await resizeImage(dataUrl, maxWidth, quality);
      const item: ScreenshotItem = {
        id: crypto.randomUUID(),
        dataUrl: resized,
      };
      setScreenshots((prev) => [...prev, item]);
      setSelectedId(item.id);
      setResultKey(null);
      setAttachFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRemove(id: string) {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    const index = screenshots.findIndex((s) => s.id === id);
    setSelectedIndex(index >= 0 ? index : null);
    setLightboxOpen(true);
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setSelectedIndex(null);
  }, []);

  const goPrevious = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev == null || prev <= 0) return prev;
      return prev - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev == null || prev >= screenshots.length - 1) return prev;
      return prev + 1;
    });
  }, [screenshots.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goPrevious();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goPrevious, goNext]);

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
          await attachScreenshot(resultKey, item.dataUrl, `${resultKey}-${item.id}.jpg`);
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

      const fields: Record<string, unknown> = {
        ...buildWorkflowFields(activeWorkflow),
        description: description.trim(),
      };

      if (assignee) {
        fields.assignee = { accountId: assignee };
      }

      const issue = await createIssue({
        summary: summary.trim(),
        projectKey: activeWorkflow.projectKey,
        issueType: activeWorkflow.issueType,
        parentKey: activeWorkflow.hasParent ? activeWorkflow.parentKey : undefined,
        fields,
        fieldMeta: activeWorkflow.fieldMeta,
      });

      let uploadedCount = 0;
      let failedItems: ScreenshotItem[] = [];
      for (const item of screenshots) {
        try {
          await attachScreenshot(issue.key, item.dataUrl, `${issue.key}-${item.id}.jpg`);
          uploadedCount++;
        } catch {
          failedItems.push(item);
        }
      }

      if (failedItems.length > 0) {
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

  const selectedItem = selectedIndex != null ? screenshots[selectedIndex] ?? null : null;

  return (
    <div className="p-3 space-y-3">
      {activeWorkflow && (
        <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          {activeWorkflow.hasParent && activeWorkflow.parentKey
            ? `${activeWorkflow.projectKey} · under ${activeWorkflow.parentKey} · ${activeWorkflow.issueType}`
            : `${activeWorkflow.projectKey} · ${activeWorkflow.issueType}`}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-surface)',
            color: 'var(--chrome-text-primary)',
            cursor: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 'not-allowed' : 'pointer',
            opacity: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 0.6 : 1,
          }}
        >
          {screenshots.length === 0 ? 'Capture Screenshot' : 'Add Screenshot'}
        </button>

        {screenshots.length > 0 && (
          <div className="mt-2 space-y-1">
            <div
              className="flex gap-2"
              style={{
                overflowX: 'auto',
                paddingBottom: '4px',
              }}
            >
              {screenshots.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onClick={() => handleSelect(item.id)}
                  onDragStart={() => { dragIdRef.current = item.id; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
                  onDrop={() => {
                    if (!dragIdRef.current || dragIdRef.current === item.id) return;
                    setScreenshots((prev) => {
                      const from = prev.findIndex((s) => s.id === dragIdRef.current);
                      const to = prev.findIndex((s) => s.id === item.id);
                      if (from < 0 || to < 0) return prev;
                      const next = [...prev];
                      next.splice(to, 0, ...next.splice(from, 1));
                      return next;
                    });
                    setDragOverId(null);
                  }}
                  onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 4,
                    border: `2px solid ${selectedId === item.id ? 'var(--chrome-blue)' : 'transparent'}`,
                    borderLeft: dragOverId === item.id ? '3px solid var(--chrome-blue)' : undefined,
                    cursor: dragIdRef.current ? 'grabbing' : 'grab',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={item.dataUrl}
                    alt="Screenshot thumbnail"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, pointerEvents: 'none' }}
                  />
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
                      borderRadius: '0 0 0 4px',
                      fontSize: '10px',
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
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              {screenshots.length} screenshot{screenshots.length === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {lightboxOpen && selectedItem && selectedIndex != null && (
          <div
            onClick={closeLightbox}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
              aria-label="Close lightbox"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                cursor: 'pointer',
                zIndex: 1001,
              }}
            >
              ×
            </button>
            {screenshots.length > 1 && selectedIndex > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrevious(); }}
                aria-label="Previous screenshot"
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 4,
                  zIndex: 1001,
                }}
              >
                ←
              </button>
            )}
            {screenshots.length > 1 && selectedIndex < screenshots.length - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next screenshot"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 4,
                  zIndex: 1001,
                }}
              >
                →
              </button>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedItem.dataUrl}
                alt="Screenshot full"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              <p style={{ color: '#fff', fontSize: '12px' }}>
                {selectedIndex + 1} / {screenshots.length}
              </p>
            </div>
          </div>
        )}
      </div>

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
