import { useEffect, useState } from 'react';
import type { AuthConfig, Workflow, CompressionSettings } from '../types';
import { getLocal } from '../lib/storage';
import { buildWorkflowFields } from '../lib/workflows';
import { setAuth, createIssue, attachScreenshot } from '../lib/jira';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';

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

export default function SingleMode({ workflows, selectedWorkflowId, isAuthed, onOpenSettings }: SingleModeProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');

  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [attachFailed, setAttachFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    setDescription(wf?.requiredFieldDefaults.description ?? '');
    setScreenshot(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
  }, [workflows, selectedWorkflowId]);

  function resetForm() {
    setSummary('');
    setDescription(activeWorkflow?.requiredFieldDefaults.description ?? '');
    setScreenshot(null);
    setResultKey(null);
    setAttachFailed(false);
    setError(null);
  }

  async function handleCapture() {
    if (isLoading) return;
    try {
      setError(null);
      const quality = activeWorkflow?.compression.quality ?? globalCompression.quality ?? 0.85;
      const maxWidth = activeWorkflow?.compression.maxWidth ?? globalCompression.maxWidth ?? 1920;
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'jpeg',
        quality: Math.round(quality * 100),
      });
      const resized = await resizeImage(dataUrl, maxWidth, quality);
      setScreenshot(resized);
      setResultKey(null);
      setAttachFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRetryAttachment() {
    if (!resultKey || !screenshot) return;
    setIsLoading(true);
    setError(null);
    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) throw new Error('Jira credentials not configured.');
      setAuth(auth);
      await attachScreenshot(resultKey, screenshot, `${resultKey}-screenshot.jpg`);
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
    if (!screenshot) {
      setError('Please capture a screenshot.');
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

      const issue = await createIssue({
        summary: summary.trim(),
        projectKey: activeWorkflow.projectKey,
        issueType: activeWorkflow.issueType,
        parentKey: activeWorkflow.hasParent ? activeWorkflow.parentKey : undefined,
        fields,
        fieldMeta: activeWorkflow.fieldMeta,
      });

      try {
        await attachScreenshot(issue.key, screenshot, `${issue.key}-screenshot.jpg`);
        setResultKey(issue.key);
        setAttachFailed(false);
      } catch (attachErr) {
        setResultKey(issue.key);
        setAttachFailed(true);
        setError(attachErr instanceof Error ? attachErr.message : String(attachErr));
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

  return (
    <div className="p-3 space-y-3">
      {activeWorkflow && (
        <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          {activeWorkflow.projectKey} · {activeWorkflow.issueType}
          {activeWorkflow.hasParent && activeWorkflow.parentKey
            ? ` · under ${activeWorkflow.parentKey}`
            : ''}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={isLoading}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-surface)',
            color: 'var(--chrome-text-primary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {screenshot ? 'Retake' : 'Capture Screenshot'}
        </button>

        {screenshot && (
          <div
            className="mt-2"
            style={{ maxWidth: 200, cursor: 'pointer' }}
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={screenshot}
              alt="Screenshot preview"
              style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid var(--chrome-border)' }}
            />
          </div>
        )}

        {screenshot && lightboxOpen && (
          <div
            onClick={() => setLightboxOpen(false)}
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
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
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
            <img
              src={screenshot}
              alt="Screenshot full"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
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

        {resultKey && !attachFailed && (
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
              created — screenshot upload failed
            </div>
            <button
              type="button"
              onClick={handleRetryAttachment}
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
              {isLoading ? 'Retrying…' : 'Retry screenshot'}
            </button>
            {error && (
              <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
                {error}
              </p>
            )}
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
          {isLoading ? 'Submitting…' : 'Create Task'}
        </button>

        {resultKey && !attachFailed && (
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded py-1.5 px-3 text-xs font-medium"
            style={{
              border: '1px solid var(--chrome-border)',
              background: 'var(--chrome-bg)',
              color: 'var(--chrome-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Create Another
          </button>
        )}
      </form>
    </div>
  );
}
