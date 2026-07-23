import { useRef, useState, useCallback, useEffect } from 'react';
import type { BulkTask } from '../types';
import { getLocal, setLocal } from '../lib/storage';
import { ConnectJiraPrompt } from './ConnectJiraPrompt';

type BulkRowStatus = 'waiting' | 'creating' | 'uploading' | 'done' | 'failed';

interface BulkRow {
  id: string;
  file: File;
  preview: string;
  summary: string;
  status: BulkRowStatus;
  issueKey?: string;
  error?: string;
}

interface BulkModeProps {
  isAuthed: boolean;
  selectedWorkflowId: string;
  domain: string;
  onOpenSettings: () => void;
}

const BULK_PROGRESS_KEY = 'jirawm_bulk_progress';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function BulkMode({ isAuthed, selectedWorkflowId, domain, onOpenSettings }: BulkModeProps) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const newRows: BulkRow[] = imageFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      summary: '',
      status: 'waiting',
    }));
    setRows((prev) => [...prev, ...newRows]);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
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
    addFiles(e.target.files);
    e.target.value = '';
  }

  function updateSummary(id: string, summary: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, summary } : row)));
  }

  function clearAll() {
    rows.forEach((row) => URL.revokeObjectURL(row.preview));
    setRows([]);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsProcessing(false);
  }

  async function buildTasks(rowsToUpload: BulkRow[]): Promise<BulkTask[]> {
    const tasks: BulkTask[] = [];
    for (const row of rowsToUpload) {
      const base64 = await fileToBase64(row.file);
      tasks.push({
        id: row.id,
        summary: row.summary || row.file.name,
        screenshotBase64: base64,
        status: 'waiting',
      });
    }
    return tasks;
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
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsProcessing(false);
      }
    }, 1000);
  }

  async function startUpload() {
    if (rows.length === 0 || !selectedWorkflowId) return;

    const tasks = await buildTasks(rows);
    setRows((prev) => prev.map((row) => ({ ...row, status: 'waiting' })));
    await setLocal(BULK_PROGRESS_KEY, tasks);
    chrome.runtime.sendMessage({ type: 'START_BULK', tasks, workflowId: selectedWorkflowId });
    startPolling();
  }

  async function retryFailed() {
    const failedRows = rows.filter((row) => row.status === 'failed');
    if (failedRows.length === 0 || !selectedWorkflowId) return;

    const tasks = await buildTasks(failedRows);
    setRows((prev) =>
      prev.map((row) => (row.status === 'failed' ? { ...row, status: 'waiting' } : row)),
    );
    chrome.runtime.sendMessage({ type: 'START_BULK', tasks, workflowId: selectedWorkflowId });
    startPolling();
  }

  const hasFailedRows = rows.some((row) => row.status === 'failed');
  const hasActiveRows = rows.some((row) => row.status === 'creating' || row.status === 'uploading');

  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);
  useEffect(() => {
    return () => {
      rowsRef.current.forEach((row) => URL.revokeObjectURL(row.preview));
    };
  }, []);

  if (!isAuthed) {
    return <ConnectJiraPrompt onOpenSettings={onOpenSettings} />;
  }

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

      {/* Task table */}
      {rows.length > 0 && (
        <div
          className="flex-1 rounded overflow-hidden"
          style={{
            border: '1px solid var(--chrome-border)',
            overflowY: 'auto',
          }}
        >
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead
              className="sticky top-0"
              style={{ background: 'var(--chrome-surface)', color: 'var(--chrome-text-secondary)' }}
            >
              <tr>
                <th className="text-left px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>#</th>
                <th className="text-left px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>Preview</th>
                <th className="text-left px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>Summary *</th>
                <th className="text-left px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)', color: 'var(--chrome-text-secondary)' }}>
                    {index + 1}
                  </td>
                  <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>
                    <img
                      src={row.preview}
                      alt={row.file.name}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2 }}
                    />
                  </td>
                  <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)' }}>
                    <input
                      type="text"
                      value={row.summary}
                      onChange={(e) => updateSummary(row.id, e.target.value)}
                      placeholder="Subtask summary"
                      disabled={isProcessing}
                      className="w-full py-0.5 px-1"
                      style={{
                        border: '1px solid var(--chrome-border)',
                        borderRadius: 0,
                        background: 'var(--chrome-bg)',
                        color: 'var(--chrome-text-primary)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </td>
                  <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--chrome-border)', color: 'var(--chrome-text-secondary)' }}>
                    {row.status === 'waiting' && '⏸️ Waiting'}
                    {row.status === 'creating' && '⏳ Creating…'}
                    {row.status === 'uploading' && '📤 Uploading…'}
                    {row.status === 'done' && row.issueKey && (
                      <a
                        href={`https://${domain}.atlassian.net/browse/${row.issueKey}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--chrome-blue)', textDecoration: 'underline' }}
                      >
                        {row.issueKey}
                      </a>
                    )}
                    {row.status === 'failed' && (
                      <span style={{ color: 'var(--chrome-red)' }}>❌ {row.error || 'Failed'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom bar */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            disabled={rows.length === 0 || isProcessing}
            onClick={startUpload}
            className="w-full rounded py-1.5 px-3 text-xs font-medium"
            style={{
              border: 'none',
              background: 'var(--chrome-blue)',
              color: '#fff',
              cursor: rows.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
              opacity: rows.length === 0 || isProcessing ? 0.6 : 1,
            }}
          >
            Start Upload
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={rows.length === 0 || isProcessing}
              onClick={clearAll}
              className="flex-1 rounded py-1.5 px-3 text-xs font-medium"
              style={{
                border: '1px solid var(--chrome-border)',
                background: 'var(--chrome-bg)',
                color: 'var(--chrome-text-secondary)',
                cursor: rows.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
                opacity: rows.length === 0 || isProcessing ? 0.6 : 1,
              }}
            >
              Clear All
            </button>
            {hasFailedRows && !hasActiveRows && (
              <button
                type="button"
                onClick={retryFailed}
                className="flex-1 rounded py-1.5 px-3 text-xs font-medium"
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
        </div>
      )}
    </div>
  );
}
