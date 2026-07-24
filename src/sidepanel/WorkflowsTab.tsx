import { useEffect, useRef, useState } from 'react';
import type { Workflow } from '../types';
import { getLocal, setLocal } from '../lib/storage';
import { getWorkflows, deleteWorkflow, WORKFLOWS_KEY } from '../lib/workflows';
import type { AuthConfig } from '../types';

interface WorkflowsTabProps {
  workflows: Workflow[];
  isAuthed: boolean;
  onNewWorkflow: () => void;
  onEditWorkflow: (workflow: Workflow) => void;
  onWorkflowsChanged: () => void;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '...';
}

export default function WorkflowsTab({
  workflows,
  isAuthed,
  onNewWorkflow,
  onEditWorkflow,
  onWorkflowsChanged,
}: WorkflowsTabProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [parentSummaries, setParentSummaries] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  // Fetch parent summaries for workflows with hasParent=true
  useEffect(() => {
    const parentWorkflows = workflows.filter((w) => w.hasParent && w.parentKey);
    if (parentWorkflows.length === 0) return;

    let cancelled = false;

    async function fetchParentSummaries() {
      const auth = await getLocal<AuthConfig>('auth');
      if (!auth || cancelled) return;

      for (const w of parentWorkflows) {
        if (cancelled) break;
        if (!w.parentKey) continue;
        if (parentSummaries[w.parentKey]) continue;

        try {
          const res = await fetch(
            `https://${auth.domain}.atlassian.net/rest/api/3/issue/${encodeURIComponent(w.parentKey)}?fields=summary`,
            {
              headers: {
                Authorization: `Basic ${btoa(`${auth.email}:${auth.apiToken}`)}`,
                'Content-Type': 'application/json',
              },
            },
          );
          if (!res.ok) continue;
          const data = (await res.json()) as { fields?: { summary?: string } };
          const summary = data.fields?.summary ?? '';
          if (!cancelled && summary) {
            setParentSummaries((prev) => ({ ...prev, [w.parentKey!]: truncate(summary, 30) }));
          }
        } catch {
          // Silently ignore — card will show key only
        }
      }
    }

    void fetchParentSummaries();
    return () => { cancelled = true; };
  }, [workflows]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExport() {
    try {
      const list = await getWorkflows();
      const json = JSON.stringify(list, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workflows-jirawm.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleImportClick() {
    setImportError(null);
    importInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const imported: unknown = JSON.parse(text);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid workflow file: expected a JSON array.');
      }

      const existing = await getWorkflows();
      const merged = [...existing];

      for (const item of imported) {
        const w = item as Workflow;
        if (!w.id || !w.name) {
          throw new Error('Invalid workflow entry: missing id or name.');
        }
        const idx = merged.findIndex((e) => e.id === w.id);
        if (idx >= 0) {
          merged[idx] = w;
        } else {
          merged.push(w);
        }
      }

      await setLocal(WORKFLOWS_KEY, merged);
      onWorkflowsChanged();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWorkflow(id);
      setConfirmDeleteId(null);
      setOpenMenuId(null);
      onWorkflowsChanged();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--chrome-bg)', color: 'var(--chrome-text-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--chrome-border)' }}
      >
        <span className="text-sm font-semibold">Workflows</span>
        <button
          onClick={onNewWorkflow}
          disabled={!isAuthed}
          title={isAuthed ? 'Create a new workflow' : 'Connect Jira first'}
          className="text-xs font-medium rounded px-2 py-1"
          style={{
            border: '1px solid var(--chrome-blue)',
            background: 'var(--chrome-bg)',
            color: isAuthed ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
            cursor: isAuthed ? 'pointer' : 'not-allowed',
            opacity: isAuthed ? 1 : 0.7,
          }}
        >
          + New
        </button>
      </div>

      {/* Import/Export toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--chrome-border)' }}
      >
        <button
          onClick={handleImportClick}
          className="text-xs rounded px-2 py-1"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-bg)',
            color: 'var(--chrome-text-primary)',
            cursor: 'pointer',
          }}
        >
          Import JSON
        </button>
        <button
          onClick={handleExport}
          className="text-xs rounded px-2 py-1"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-bg)',
            color: 'var(--chrome-text-primary)',
            cursor: 'pointer',
          }}
        >
          Export JSON
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
      </div>

      {importError && (
        <div
          className="px-3 py-1.5 text-xs shrink-0"
          style={{ color: 'var(--chrome-red)', background: 'rgba(217,48,37,0.06)' }}
        >
          ✗ {importError}
        </div>
      )}

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto p-3">
        {workflows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 text-center"
            style={{ minHeight: '200px' }}
          >
            <p className="text-sm" style={{ color: 'var(--chrome-text-secondary)' }}>
              No workflows yet.
            </p>
            <button
              onClick={onNewWorkflow}
              disabled={!isAuthed}
              title={isAuthed ? 'Create a new workflow' : 'Connect Jira first'}
              className="text-xs font-medium rounded px-3 py-1.5"
              style={{
                border: '1px solid var(--chrome-blue)',
                background: 'var(--chrome-bg)',
                color: isAuthed ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
                cursor: isAuthed ? 'pointer' : 'not-allowed',
                opacity: isAuthed ? 1 : 0.7,
              }}
            >
              + Create first workflow
            </button>
          </div>
        ) : (
          workflows.map((w) => (
            <div
              key={w.id}
              style={{
                position: 'relative',
                background: 'var(--chrome-surface)',
                border: '1px solid var(--chrome-border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
              }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="text-sm font-semibold pr-6"
                  style={{ color: 'var(--chrome-text-primary)' }}
                >
                  {w.name}
                </span>
                <div style={{ position: 'relative' }} ref={openMenuId === w.id ? menuRef : undefined}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === w.id ? null : w.id)}
                    className="text-sm"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--chrome-text-secondary)',
                      padding: '0 4px',
                    }}
                    aria-label="Workflow actions"
                  >
                    ⋮
                  </button>
                  {openMenuId === w.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        zIndex: 10,
                        background: 'var(--chrome-bg)',
                        border: '1px solid var(--chrome-border)',
                        borderRadius: '4px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        minWidth: '120px',
                      }}
                    >
                      <button
                        onClick={() => {
                          onEditWorkflow(w);
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left text-xs px-3 py-2"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--chrome-text-primary)',
                        }}
                      >
                        ✏ Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(w.id)}
                        className="w-full text-left text-xs px-3 py-2"
                        style={{
                          background: 'none',
                          border: 'none',
                          borderTop: '1px solid var(--chrome-border)',
                          cursor: 'pointer',
                          color: 'var(--chrome-red)',
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="mt-2 text-xs"
                style={{ color: 'var(--chrome-text-secondary)', lineHeight: 1.6 }}
              >
                <div>Project: {w.projectName}</div>
                {w.hasParent && w.parentKey && (
                  <div>
                    Parent: {w.parentKey}
                    {parentSummaries[w.parentKey] ? ` — ${parentSummaries[w.parentKey]}` : ''}
                  </div>
                )}
                <div>Creates: {w.issueType} · Auto-numbered</div>
                <div>Assignee: {w.defaultAssigneeName ?? 'Unassigned'}</div>
              </div>

              {confirmDeleteId === w.id && (
                <div
                  className="mt-3 p-2 rounded text-xs"
                  style={{
                    background: 'rgba(217,48,37,0.08)',
                    border: '1px solid var(--chrome-border)',
                  }}
                >
                  <p style={{ color: 'var(--chrome-text-primary)', margin: '0 0 8px 0' }}>
                    Delete workflow "{w.name}"?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="text-xs font-medium rounded px-2 py-1"
                      style={{
                        border: 'none',
                        background: 'var(--chrome-red)',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs rounded px-2 py-1"
                      style={{
                        border: '1px solid var(--chrome-border)',
                        background: 'var(--chrome-bg)',
                        color: 'var(--chrome-text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}