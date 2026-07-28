import { useEffect, useRef, useState } from 'react';
import type { ScreenshotItem, AuthConfig } from '../types';
import { getLocal } from '../lib/storage';
import {
  setAuth,
  getProjects,
  attachScreenshot,
  buildCommentADF,
  addComment,
  buildCommentUrl,
} from '../lib/jira';
import IssuePicker from './components/IssuePicker';
import ScreenshotCapture from './components/ScreenshotCapture';

interface AttachedScreenshot {
  screenshotId: string;
  attachmentId: string;
  shortcode: number;
}

type ProjectsState =
  | { status: 'loading' }
  | { status: 'ready'; projects: Array<{ id: string; key: string; name: string }> }
  | { status: 'error'; message: string };

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'attach-partial'; failedIndices: number[]; attached: AttachedScreenshot[]; successCount: number }
  | { status: 'comment-error'; message: string; attached: AttachedScreenshot[] }
  | { status: 'success'; issueKey: string; commentId: string; commentText: string };

export default function CommentMode() {
  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: 'loading' });
  const [selectedProject, setSelectedProject] = useState<{ id: string; key: string } | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<{ key: string; summary: string } | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [shortcodeMap, setShortcodeMap] = useState<Map<string, number>>(new Map());
  const counterRef = useRef(1);
  const [commentText, setCommentText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await getLocal<AuthConfig>('auth');
      if (cancelled) return;
      if (!auth) {
        setProjectsState({ status: 'error', message: 'Jira not configured. Open Settings first.' });
        return;
      }
      setAuth(auth);
      try {
        const projects = await getProjects();
        if (!cancelled) setProjectsState({ status: 'ready', projects });
      } catch (err) {
        if (!cancelled) setProjectsState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleScreenshotsChange(next: ScreenshotItem[]) {
    setShortcodeMap((prev) => {
      const updated = new Map(prev);
      for (const s of next) {
        if (!updated.has(s.id)) {
          updated.set(s.id, counterRef.current++);
        }
      }
      return updated;
    });
    setScreenshots(next);
  }

  function insertShortcode(shortcode: number, filename: string) {
    const token = `[${shortcode}-${filename}]`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setCommentText((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart ?? commentText.length;
    const end = textarea.selectionEnd ?? commentText.length;
    const next = commentText.slice(0, start) + token + commentText.slice(end);
    setCommentText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function resetForm() {
    setScreenshots([]);
    setShortcodeMap(new Map());
    counterRef.current = 1;
    setCommentText('');
    setSubmitState({ status: 'idle' });
  }

  function handleNewCommentSameIssue() {
    resetForm();
  }

  function handleNewCommentFullReset() {
    setSelectedIssue(null);
    setSelectedProject(null);
    resetForm();
  }

  async function runAttachments(
    issueKey: string,
    items: ScreenshotItem[],
  ): Promise<{ attached: AttachedScreenshot[]; failedIndices: number[] }> {
    const attached: AttachedScreenshot[] = [];
    const failedIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const shortcode = shortcodeMap.get(item.id) ?? i + 1;
      const filename = `${shortcode}-${item.filename}`;
      try {
        const { id: attachmentId } = await attachScreenshot(issueKey, item.dataUrl, filename);
        attached.push({ screenshotId: item.id, attachmentId, shortcode });
      } catch {
        failedIndices.push(i);
      }
    }

    return { attached, failedIndices };
  }

  async function runAddComment(issueKey: string): Promise<{ id: string }> {
    const adfBody = buildCommentADF(commentText);
    const { id } = await addComment(issueKey, adfBody);
    return { id };
  }

  async function handleSubmit() {
    if (!selectedIssue) return;
    if (!commentText.trim() && screenshots.length === 0) return;

    setSubmitState({ status: 'submitting' });

    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) throw new Error('Jira credentials not configured. Open Settings first.');
      setAuth(auth);

      const { attached, failedIndices } = await runAttachments(selectedIssue.key, screenshots);

      if (failedIndices.length > 0) {
        setSubmitState({
          status: 'attach-partial',
          failedIndices,
          attached,
          successCount: attached.length,
        });
        return;
      }

      const issueKeySnapshot = selectedIssue.key;
      const commentTextSnapshot = commentText;
      const { id } = await runAddComment(issueKeySnapshot);
      setSubmitState({ status: 'success', issueKey: issueKeySnapshot, commentId: id, commentText: commentTextSnapshot });
    } catch (err) {
      setSubmitState({ status: 'comment-error', message: err instanceof Error ? err.message : String(err), attached: [] });
    }
  }

  async function retryFailedAttachments() {
    if (submitState.status !== 'attach-partial') return;
    if (!selectedIssue) return;

    const { failedIndices, attached: previousAttached } = submitState;
    setSubmitState({ status: 'submitting' });

    try {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth) throw new Error('Jira credentials not configured.');
      setAuth(auth);

      const stillFailed: number[] = [];
      const newAttached: AttachedScreenshot[] = [...previousAttached];
      let retrySuccess = 0;

      for (const idx of failedIndices) {
        const item = screenshots[idx];
        if (!item) continue;
        const shortcode = shortcodeMap.get(item.id) ?? idx + 1;
        const filename = `${shortcode}-${item.filename}`;
        try {
          const { id: attachmentId } = await attachScreenshot(selectedIssue.key, item.dataUrl, filename);
          newAttached.push({ screenshotId: item.id, attachmentId, shortcode });
          retrySuccess++;
        } catch {
          stillFailed.push(idx);
        }
      }

      if (stillFailed.length > 0) {
        setSubmitState({
          status: 'attach-partial',
          failedIndices: stillFailed,
          attached: newAttached,
          successCount: retrySuccess,
        });
        return;
      }

      const issueKeySnapshot = selectedIssue.key;
      const commentTextSnapshot = commentText;
      const { id } = await runAddComment(issueKeySnapshot);
      setSubmitState({ status: 'success', issueKey: issueKeySnapshot, commentId: id, commentText: commentTextSnapshot });
    } catch (err) {
      setSubmitState({
        status: 'comment-error',
        message: err instanceof Error ? err.message : String(err),
        attached: submitState.status === 'attach-partial' ? submitState.attached : [],
      });
    }
  }

  async function retryAddComment() {
    if (submitState.status !== 'comment-error') return;
    if (!selectedIssue) return;

    const { attached } = submitState;
    setSubmitState({ status: 'submitting' });

    try {
      const issueKeySnapshot = selectedIssue.key;
      const commentTextSnapshot = commentText;
      const { id } = await runAddComment(issueKeySnapshot);
      setSubmitState({ status: 'success', issueKey: issueKeySnapshot, commentId: id, commentText: commentTextSnapshot });
    } catch (err) {
      setSubmitState({
        status: 'comment-error',
        message: err instanceof Error ? err.message : String(err),
        attached,
      });
    }
  }

  const isSubmitting = submitState.status === 'submitting';
  const canSubmit = Boolean(selectedIssue) && (commentText.trim().length > 0 || screenshots.length > 0) && !isSubmitting;

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

  if (submitState.status === 'success') {
    return (
      <div className="p-3 space-y-3">
        <div
          className="rounded p-3 text-xs space-y-2"
          style={{ background: 'rgba(30, 142, 62, 0.1)', color: 'var(--chrome-text-primary)' }}
        >
          <div style={{ color: 'var(--chrome-green)' }}>✓ Comment posted</div>
          <a
            href={buildCommentUrl(submitState.issueKey, submitState.commentId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--chrome-blue)', textDecoration: 'underline' }}
          >
            View comment on {submitState.issueKey}
          </a>
        </div>
        <button
          type="button"
          onClick={handleNewCommentSameIssue}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-green)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          New comment on {submitState.issueKey}
        </button>
        <button
          type="button"
          onClick={handleNewCommentFullReset}
          className="w-full rounded py-1.5 px-3 text-xs font-medium"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'transparent',
            color: 'var(--chrome-text-primary)',
            cursor: 'pointer',
          }}
        >
          New comment
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Project <span style={{ color: 'var(--chrome-red)' }}>*</span></label>
        {projectsState.status === 'loading' && (
          <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>Loading projects…</p>
        )}
        {projectsState.status === 'error' && (
          <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>✗ {projectsState.message}</p>
        )}
        {projectsState.status === 'ready' && (
          <select
            value={selectedProject?.key ?? ''}
            onChange={(e) => {
              const p = projectsState.projects.find((proj) => proj.key === e.target.value) ?? null;
              setSelectedProject(p ? { id: p.id, key: p.key } : null);
              setSelectedIssue(null);
            }}
            style={inputStyle}
          >
            <option value="">Select a project…</option>
            {projectsState.projects.map((p) => (
              <option key={p.id} value={p.key}>
                {p.key} — {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProject && (
        <div>
          <label style={labelStyle}>Issue <span style={{ color: 'var(--chrome-red)' }}>*</span></label>
          <IssuePicker
            value={selectedIssue}
            onChange={setSelectedIssue}
            projectId={selectedProject.id}
            projectKey={selectedProject.key}
            placeholder="Search issue by key or summary…"
          />
        </div>
      )}

      <ScreenshotCapture
        screenshots={screenshots}
        onChange={handleScreenshotsChange}
        maxScreenshots={10}
        isLoading={isSubmitting}
      />

      {screenshots.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {screenshots.map((s) => {
            const shortcode = shortcodeMap.get(s.id);
            if (shortcode === undefined) return null;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => insertShortcode(shortcode, s.filename)}
                className="text-xs rounded px-1.5 py-0.5"
                style={{
                  border: '1px solid var(--chrome-border)',
                  background: 'var(--chrome-surface)',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                [{shortcode}-{s.filename}]
              </button>
            );
          })}
        </div>
      )}

      <div>
        <label style={labelStyle}>Comment</label>
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={isSubmitting}
          style={{ ...inputStyle, resize: 'vertical', minHeight: '160px' }}
          placeholder="Write your comment… click a chip above to insert a screenshot token"
        />
      </div>

      {submitState.status === 'attach-partial' && (
        <div
          className="rounded p-2 text-xs space-y-2"
          style={{ background: 'rgba(251, 188, 5, 0.1)', color: 'var(--chrome-text-primary)' }}
        >
          <div>
            ⚠️ {submitState.successCount}/{submitState.successCount + submitState.failedIndices.length} screenshots uploaded — comment not yet posted
          </div>
          <button
            type="button"
            onClick={() => { void retryFailedAttachments(); }}
            className="w-full rounded py-1 px-2 text-xs font-medium"
            style={{
              border: 'none',
              background: 'var(--chrome-blue)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Retry failed screenshots ({submitState.failedIndices.length})
          </button>
        </div>
      )}

      {submitState.status === 'comment-error' && (
        <div
          className="rounded p-2 text-xs space-y-2"
          style={{ background: 'rgba(217, 48, 37, 0.1)', color: 'var(--chrome-red)' }}
        >
          <div>{submitState.message}</div>
          <button
            type="button"
            onClick={() => { void retryAddComment(); }}
            className="w-full rounded py-1 px-2 text-xs font-medium"
            style={{
              border: 'none',
              background: 'var(--chrome-blue)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Retry comment
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => { void handleSubmit(); }}
        disabled={!canSubmit}
        className="w-full rounded py-1.5 px-3 text-xs font-medium"
        style={{
          border: 'none',
          background: 'var(--chrome-green)',
          color: '#fff',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
            Submitting…
          </span>
        ) : 'Post Comment'}
      </button>
    </div>
  );
}
