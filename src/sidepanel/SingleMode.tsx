import { useEffect, useState } from 'react';
import type { AuthConfig, Workflow } from '../types';
import { getLocal } from '../lib/storage';
import { setAuth, createIssue, attachScreenshot } from '../lib/jira';

interface SingleModeProps {
  workflows: Workflow[];
  selectedWorkflowId: string;
}

function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });
}

export default function SingleMode({ workflows, selectedWorkflowId }: SingleModeProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [parentKey, setParentKey] = useState('');
  const [reporter, setReporter] = useState('');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');

  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);

  useEffect(() => {
    getLocal<string>('accountId')
      .then((id) => setReporter(id ?? ''))
      .catch(() => setReporter(''));
  }, []);

  useEffect(() => {
    const wf = workflows.find((w) => w.id === selectedWorkflowId) ?? null;
    setActiveWorkflow(wf);
    if (wf) {
      const prefix = wf.summaryPrefix ? `${wf.summaryPrefix} ` : '';
      setSummary(prefix);
      setParentKey(wf.parentKey);
    } else {
      setSummary('');
      setParentKey('');
    }
    setAssignee('');
    setDescription('');
    setScreenshot(null);
    setResultKey(null);
    setError(null);
  }, [workflows, selectedWorkflowId]);

  async function handleCapture() {
    try {
      setError(null);
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 85 });
      const resized = await resizeImage(dataUrl, 1920);
      setScreenshot(resized);
      setResultKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultKey(null);

    if (!summary.trim()) {
      setError('Summary is required.');
      return;
    }
    if (!parentKey.trim()) {
      setError('Parent Epic Key is required.');
      return;
    }
    if (!screenshot) {
      setError('Please capture a screenshot.');
      return;
    }
    if (!activeWorkflow) {
      setError('No workflow selected.');
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
        description: description.trim(),
      };
      if (reporter.trim()) {
        fields.reporter = { id: reporter.trim() };
      }
      if (assignee.trim()) {
        fields.assignee = { id: assignee.trim() };
      }

      const issue = await createIssue({
        summary: summary.trim(),
        projectKey: activeWorkflow.project,
        issueType: activeWorkflow.issueType,
        parentKey: parentKey.trim(),
        fields,
      });

      await attachScreenshot(issue.key, screenshot, `${issue.key}-screenshot.jpg`);
      setResultKey(issue.key);
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
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--chrome-text-secondary)',
    marginBottom: '2px',
  };

  return (
    <div className="p-3 space-y-3">
      <div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={isLoading}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-blue)',
            color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {screenshot ? 'Retake' : 'Capture Screenshot'}
        </button>

        {screenshot && (
          <div className="mt-2" style={{ maxWidth: 200 }}>
            <img
              src={screenshot}
              alt="Screenshot preview"
              style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid var(--chrome-border)' }}
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
          <label style={labelStyle}>Parent Epic Key *</label>
          <input
            type="text"
            value={parentKey}
            onChange={(e) => setParentKey(e.target.value)}
            disabled={isLoading}
            style={inputStyle}
            placeholder="PROJ-123"
          />
        </div>

        <div>
          <label style={labelStyle}>Reporter</label>
          <input
            type="text"
            value={reporter}
            readOnly
            style={{ ...inputStyle, background: 'var(--chrome-surface)', color: 'var(--chrome-text-secondary)' }}
            placeholder="Not configured"
          />
        </div>

        <div>
          <label style={labelStyle}>Assignee</label>
          <input
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={isLoading}
            style={inputStyle}
            placeholder="accountId (optional)"
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

        {resultKey && (
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-green)',
            color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
