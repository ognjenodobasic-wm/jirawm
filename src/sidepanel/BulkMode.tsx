import { useRef, useState, useCallback, useEffect } from 'react';
import type { BulkTask, Workflow, AppSettings, ImageSettings } from '../types';
import { getLocal, setLocal, getAppSettings } from '../lib/storage';
import { normalizeImage, toJpegFilename } from '../lib/image';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';
import AssigneeSelect from './components/AssigneeSelect';

type BulkRowStatus = 'waiting' | 'creating' | 'uploading' | 'done' | 'failed';

export interface BulkRow {
  id: string;
  dataUrl: string;
  originalFilename: string;
  filename: string;
  summary: string;
  description: string;
  assignee: string | null;
  status: BulkRowStatus;
  issueKey?: string;
  error?: string;
}

interface BulkModeProps {
  isAuthed: boolean;
  selectedWorkflowId: string;
  workflows: Workflow[];
  domain: string;
  onOpenSettings: () => void;
  rows: BulkRow[];
  setRows: React.Dispatch<React.SetStateAction<BulkRow[]>>;
}

const BULK_PROGRESS_KEY = 'jirawm_bulk_progress';

type StartBulkResponse = {
  ok: boolean;
  error?: string;
};

export default function BulkMode({ isAuthed, selectedWorkflowId, workflows, domain, onOpenSettings, rows, setRows }: BulkModeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPreview, setLightboxPreview] = useState<string | null>(null);
  const [numberBulkFiles, setNumberBulkFiles] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAppliedWorkflowIdRef = useRef<string>('');

  const activeWorkflow = workflows.find((w) => w.id === selectedWorkflowId) ?? null;

  useEffect(() => {
    getAppSettings().then((settings) => {
      setNumberBulkFiles(settings.naming.numberBulkFiles);
    });
  }, []);

  function buildImageSettings(app: AppSettings | null): ImageSettings {
    return {
      quality: app?.image.quality ?? 0.85,
      maxWidth: app?.image.maxWidth ?? 1920,
      transparencyFill: app?.image.transparencyFill ?? 'white',
    };
  }

  const assignBulkFilenames = useCallback((rowsToName: BulkRow[]): BulkRow[] => {
    if (!numberBulkFiles) return rowsToName;
    return rowsToName.map((row, index) => {
      const base = row.originalFilename.replace(/\.jpg$/, '');
      return { ...row, filename: `${index + 1} - ${base}.jpg` };
    });
  }, [numberBulkFiles]);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const defaultAssignee = activeWorkflow?.defaultAssignee ?? null;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

    const app = await getAppSettings();
    const imageSettings = buildImageSettings(app);

    const newRows: BulkRow[] = [];
    for (const file of imageFiles) {
      try {
        const { dataUrl } = await normalizeImage(file, imageSettings);
        const normalizedFilename = toJpegFilename(file.name);
        newRows.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dataUrl,
          originalFilename: normalizedFilename,
          filename: normalizedFilename,
          summary: '',
          description: '',
          assignee: defaultAssignee,
          status: 'waiting',
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to ingest file:', file.name, err);
      }
    }
    setRows((prev) => assignBulkFilenames([...prev.filter((row) => row.status !== 'done'), ...newRows]));
  }, [activeWorkflow?.defaultAssignee, setRows, assignBulkFilenames]);

  function removeRow(id: string) {
    setRows((prev) => assignBulkFilenames(prev.filter((r) => r.id !== id)));
  }

  // Apply workflow default assignee to existing rows only on first workflow selection.
  useEffect(() => {
    if (!selectedWorkflowId) {
      lastAppliedWorkflowIdRef.current = '';
      return;
    }
    const wf = workflows.find((w) => w.id === selectedWorkflowId);
    if (!wf) return;

    if (lastAppliedWorkflowIdRef.current === '') {
      // First time a workflow is selected: propagate default to all existing rows.
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          assignee: wf.defaultAssignee ?? null,
        })),
      );
    }
    lastAppliedWorkflowIdRef.current = selectedWorkflowId;
  }, [selectedWorkflowId, workflows, setRows]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    void addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    void addFiles(e.target.files);
    e.target.value = '';
  }

  function updateSummary(id: string, summary: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, summary } : row)));
  }

  function updateDescription(id: string, description: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, description } : row)));
  }

  function updateAssignee(id: string, assignee: string | null) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, assignee } : row)));
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsProcessing(false);
  }

  async function signalStartBulk(workflowId: string): Promise<StartBulkResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'START_BULK', workflowId }, (response?: StartBulkResponse) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (!response) {
          resolve({ ok: false, error: 'No response from background worker.' });
          return;
        }
        resolve(response);
      });
    });
  }

  function clearAll() {
    setRows([]);
    stopPolling();
    setStartError(null);
  }

  function handleClearAllClick() {
    if (hasUnuploadedWork && !confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    clearAll();
    setConfirmClearAll(false);
  }

  async function buildTasks(rowsToUpload: BulkRow[]): Promise<BulkTask[]> {
    return rowsToUpload.map((row) => ({
      id: row.id,
      summary: row.summary || row.filename,
      description: row.description,
      assignee: row.assignee ?? undefined,
      screenshotBase64: row.dataUrl,
      status: 'waiting',
      attachmentName: row.filename,
    }));
  }

  function startPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setIsProcessing(true);
    pollingRef.current = setInterval(async () => {
      const progress = await getLocal<BulkTask[]>(BULK_PROGRESS_KEY);
      if (!progress) return;
      setRows((prev) =>
        prev.map((row) => {
          const task = progress.find((t) => t.id === row.id);
          if (!task) return row;
          return {
            ...row,
            status: task.status,
            issueKey: task.issueKey,
            error: task.error,
          };
        }),
      );
      if (progress.every((t) => t.status === 'done' || t.status === 'failed')) {
        stopPolling();
      }
    }, 1000);
  }

  async function startUpload() {
    if (rows.length === 0 || !selectedWorkflowId) return;
    if (hasEmptySummary) {
      setStartError('Every row needs a summary before you can start the upload.');
      return;
    }

    const rowsToSubmit = rows.filter((row) => row.status !== 'done');
    if (rowsToSubmit.length === 0) return;

    setStartError(null);
    setIsProcessing(true);

    const tasks = (await buildTasks(rowsToSubmit)).map((task) => ({ ...task, workflowId: selectedWorkflowId }));
    setRows((prev) =>
      prev.map((row) => (row.status !== 'done' ? { ...row, status: 'waiting', error: undefined } : row)),
    );
    await setLocal(BULK_PROGRESS_KEY, tasks);

    const response = await signalStartBulk(selectedWorkflowId);
    if (!response.ok) {
      stopPolling();
      setStartError(response.error || 'Failed to start bulk upload in background worker.');
      return;
    }

    startPolling();
  }

  async function retryFailed() {
    const failedRows = rows.filter((row) => row.status === 'failed');
    if (failedRows.length === 0 || !selectedWorkflowId) return;

    setStartError(null);

    const progress = (await getLocal<BulkTask[]>(BULK_PROGRESS_KEY)) ?? [];
    const resetProgress = progress.map((task) =>
      task.status === 'failed'
        ? { ...task, status: 'waiting' as const, error: undefined }
        : task,
    );
    await setLocal(BULK_PROGRESS_KEY, resetProgress);
    setRows((prev) =>
      prev.map((row) => (row.status === 'failed' ? { ...row, status: 'waiting', error: undefined } : row)),
    );

    const response = await signalStartBulk(selectedWorkflowId);
    if (!response.ok) {
      stopPolling();
      setStartError(response.error || 'Failed to restart bulk upload in background worker.');
      return;
    }

    startPolling();
  }

  const hasFailedRows = rows.some((row) => row.status === 'failed');
  const hasActiveRows = rows.some((row) => row.status === 'creating' || row.status === 'uploading');
  const hasUnuploadedWork = rows.some((row) => row.status !== 'done');
  const hasEmptySummary = rows.some((row) => row.status !== 'done' && !row.summary.trim());

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    setStartError(null);
  }, [selectedWorkflowId]);

  function openLightbox(preview: string) {
    setLightboxPreview(preview);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxPreview(null);
  }

  if (!isAuthed) {
    return <ConnectJiraPrompt onOpenSettings={onOpenSettings} />;
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
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1 text-center"
        style={{
          border: `2px dashed ${isDragging ? 'var(--chrome-blue)' : 'var(--chrome-border)'}`,
          borderRadius: '8px',
          padding: '24px',
          background: 'var(--chrome-surface)',
          cursor: 'pointer',
        }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--chrome-text-primary)' }}>
          Drop screenshots here
        </p>
        <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          or
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="rounded px-3 py-1 text-xs font-medium"
          style={{
            border: 'none',
            background: 'var(--chrome-blue)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Choose files
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

      {isProcessing && (
        <div style={{ position: 'relative', height: 2, overflow: 'hidden', borderRadius: 2, background: 'var(--chrome-border)' }}>
          <style>{`
            @keyframes bulkScan {
              0% { left: -30%; }
              100% { left: 100%; }
            }
          `}</style>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-30%',
              width: '30%',
              height: '100%',
              background: 'var(--chrome-blue)',
              animation: 'bulkScan 1.2s linear infinite',
            }}
          />
        </div>
      )}

      {startError && (
        <div
          className="rounded px-2 py-1.5 text-xs"
          style={{
            border: '1px solid var(--chrome-red)',
            background: 'var(--chrome-surface)',
            color: 'var(--chrome-red)',
          }}
        >
          ❌ {startError}
        </div>
      )}

      {/* Task cards */}
      {rows.length > 0 && (
        <div
          className="flex-1 flex flex-col gap-2"
          style={{
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded p-2 space-y-2"
              style={{
                border: '1px solid var(--chrome-border)',
                background: 'var(--chrome-surface)',
              }}
            >
              <div className="flex items-start gap-2">
                <img
                  src={row.dataUrl}
                  alt={row.filename}
                  onClick={() => openLightbox(row.dataUrl)}
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: 4,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs truncate"
                    style={{ color: 'var(--chrome-text-primary)' }}
                    title={row.filename}
                  >
                    {row.filename}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={isProcessing}
                  aria-label="Remove row"
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    border: '1px solid var(--chrome-red)',
                    background: 'var(--chrome-bg)',
                    color: 'var(--chrome-red)',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div>
                <label style={labelStyle}>Summary *</label>
                <input
                  type="text"
                  value={row.summary}
                  onChange={(e) => updateSummary(row.id, e.target.value)}
                  placeholder="Subtask summary"
                  disabled={isProcessing}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={row.description}
                  onChange={(e) => updateDescription(row.id, e.target.value)}
                  placeholder="Description (optional)"
                  disabled={isProcessing}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Assignee</label>
                <AssigneeSelect
                  projectKey={activeWorkflow?.projectKey ?? ''}
                  value={row.assignee}
                  onChange={(value) => updateAssignee(row.id, value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                {row.status === 'waiting' && '⏸️ Waiting'}
                {row.status === 'creating' && '⏳ Creating…'}
                {row.status === 'uploading' && '📤 Uploading…'}
                {row.status === 'done' && row.issueKey && (
                  <span style={{ color: 'var(--chrome-green)' }}>
                    ✅ Success —{' '}
                    <a
                      href={`https://${domain}.atlassian.net/browse/${row.issueKey}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--chrome-green)', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      {row.issueKey}
                    </a>
                  </span>
                )}
                {row.status === 'failed' && (
                  <span style={{ color: 'var(--chrome-red)' }}>❌ Error: {row.error || 'Failed'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={rows.length === 0 || isProcessing}
              onClick={handleClearAllClick}
              style={{
                flex: 2,
                border: '1px solid var(--chrome-border)',
                background: 'var(--chrome-bg)',
                color: 'var(--chrome-text-secondary)',
                cursor: rows.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
                opacity: rows.length === 0 || isProcessing ? 0.6 : 1,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {confirmClearAll ? 'Confirm?' : 'Clear All'}
            </button>
            <button
              type="button"
              disabled={rows.length === 0 || isProcessing || hasEmptySummary || !hasUnuploadedWork}
              onClick={startUpload}
              style={{
                flex: 8,
                border: 'none',
                background: 'var(--chrome-green)',
                color: '#fff',
                cursor: rows.length === 0 || isProcessing || hasEmptySummary ? 'not-allowed' : 'pointer',
                opacity: rows.length === 0 || isProcessing || hasEmptySummary ? 0.6 : 1,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              Start Upload
            </button>
          </div>
          {hasFailedRows && !hasActiveRows && (
            <button
              type="button"
              onClick={retryFailed}
              className="w-full rounded py-1.5 px-3 text-xs font-medium"
              style={{
                border: '1px solid var(--chrome-red)',
                background: 'var(--chrome-bg)',
                color: 'var(--chrome-red)',
                cursor: 'pointer',
              }}
            >
              Retry Failed
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && lightboxPreview && (
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
          <img
            src={lightboxPreview}
            alt="Screenshot full"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
