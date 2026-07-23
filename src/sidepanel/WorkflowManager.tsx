import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Workflow, JiraField } from '../types';
import { getWorkflows, saveWorkflow, deleteWorkflow } from '../lib/workflows';
import { fetchCreatemeta } from '../lib/jira';

type MetaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; requiredFields: JiraField[]; optionalFields: JiraField[] }
  | { status: 'error'; message: string };

const inputStyle: CSSProperties = {
  border: '1px solid var(--chrome-border)',
  background: 'var(--chrome-surface)',
  color: 'var(--chrome-text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const ghostBtn: CSSProperties = {
  border: '1px solid var(--chrome-border)',
  background: 'var(--chrome-bg)',
  color: 'var(--chrome-text-secondary)',
  cursor: 'pointer',
};

export default function WorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [project, setProject] = useState('');
  const [issueType, setIssueType] = useState('');
  const [parentKey, setParentKey] = useState('');
  const [summaryPrefix, setSummaryPrefix] = useState('');

  const [metaState, setMetaState] = useState<MetaState>({ status: 'idle' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getWorkflows().then(setWorkflows);
  }, []);

  // Fetch createmeta (debounced) when both project key and issue type are filled
  useEffect(() => {
    if (!formOpen || !project.trim() || !issueType.trim()) {
      setMetaState({ status: 'idle' });
      return;
    }
    setMetaState({ status: 'loading' });
    const timer = setTimeout(() => {
      fetchCreatemeta(project.trim().toUpperCase(), issueType.trim())
        .then(({ requiredFields, optionalFields }) =>
          setMetaState({ status: 'ok', requiredFields, optionalFields }),
        )
        .catch((err) =>
          setMetaState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          }),
        );
    }, 700);
    return () => clearTimeout(timer);
  }, [project, issueType, formOpen]);

  // Cleanup delete timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  function openNew() {
    setEditingId(null);
    setName('');
    setProject('');
    setIssueType('');
    setParentKey('');
    setSummaryPrefix('');
    setMetaState({ status: 'idle' });
    setFormOpen(true);
  }

  function openEdit(w: Workflow) {
    setEditingId(w.id);
    setName(w.name);
    setProject(w.project);
    setIssueType(w.issueType);
    setParentKey(w.parentKey);
    setSummaryPrefix(w.summaryPrefix ?? '');
    setMetaState({ status: 'idle' });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setMetaState({ status: 'idle' });
  }

  async function handleSave() {
    if (!name.trim() || !project.trim() || !issueType.trim()) return;

    const existing = editingId ? workflows.find((w) => w.id === editingId) : undefined;

    const workflow: Workflow = {
      id: editingId ?? crypto.randomUUID(),
      name: name.trim(),
      project: project.trim().toUpperCase(),
      issueType: issueType.trim(),
      parentKey: parentKey.trim(),
      summaryPrefix: summaryPrefix.trim() || undefined,
      compression: existing?.compression ?? { quality: 0.8, maxWidth: 1920 },
      presets: existing?.presets ?? {},
      requiredFields:
        metaState.status === 'ok' ? metaState.requiredFields : (existing?.requiredFields ?? []),
      optionalFields:
        metaState.status === 'ok' ? metaState.optionalFields : (existing?.optionalFields ?? []),
    };

    await saveWorkflow(workflow);
    setWorkflows(await getWorkflows());
    closeForm();
  }

  function handleDeleteClick(id: string) {
    if (deleteConfirmId === id) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeleteConfirmId(null);
      deleteWorkflow(id)
        .then(() => getWorkflows())
        .then(setWorkflows)
        .catch(console.error);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeleteConfirmId(id);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  }

  const canSave =
    name.trim().length > 0 && project.trim().length > 0 && issueType.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold tracking-wide"
          style={{ color: 'var(--chrome-text-secondary)' }}
        >
          WORKFLOWS
        </span>
        {!formOpen && (
          <button
            onClick={openNew}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              border: '1px solid var(--chrome-border)',
              background: 'var(--chrome-surface)',
              color: 'var(--chrome-blue)',
              cursor: 'pointer',
            }}
          >
            + New
          </button>
        )}
      </div>

      {/* Workflow list */}
      {workflows.length === 0 && !formOpen && (
        <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          No workflows yet.
        </p>
      )}

      {workflows.length > 0 && (
        <div className="flex flex-col gap-1">
          {workflows.map((w) => {
            const pendingDelete = deleteConfirmId === w.id;
            return (
              <div
                key={w.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{
                  background: 'var(--chrome-surface)',
                  border: '1px solid var(--chrome-border)',
                }}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--chrome-text-primary)' }}
                  >
                    {w.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                    {w.project} · {w.issueType}
                  </span>
                </div>
                <button
                  onClick={() => openEdit(w)}
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={ghostBtn}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(w.id)}
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    ...ghostBtn,
                    border: pendingDelete
                      ? '1px solid var(--chrome-red)'
                      : '1px solid var(--chrome-border)',
                    color: pendingDelete ? 'var(--chrome-red)' : 'var(--chrome-text-secondary)',
                  }}
                >
                  {pendingDelete ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline create / edit form */}
      {formOpen && (
        <div
          className="flex flex-col gap-3 p-2 rounded"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-surface)',
          }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--chrome-text-primary)' }}>
            {editingId ? 'Edit workflow' : 'New workflow'}
          </span>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Name *
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="QA Bug Report"
              className="px-2 py-1 text-xs rounded"
              style={inputStyle}
            />
          </div>

          {/* Project key */}
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Project key *
            </span>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value.toUpperCase())}
              placeholder="AT"
              className="px-2 py-1 text-xs rounded"
              style={inputStyle}
            />
          </div>

          {/* Issue type */}
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Issue type *
            </span>
            <input
              type="text"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              placeholder="Bug"
              className="px-2 py-1 text-xs rounded"
              style={inputStyle}
            />
          </div>

          {/* Createmeta status */}
          {metaState.status === 'loading' && (
            <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Loading Jira fields…
            </p>
          )}
          {metaState.status === 'ok' && (
            <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>
              ✓ Fields loaded ({metaState.requiredFields.length} required,{' '}
              {metaState.optionalFields.length} optional)
            </p>
          )}
          {metaState.status === 'error' && (
            <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
              ✗ {metaState.message}
            </p>
          )}

          {/* Parent epic key */}
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Parent epic key (optional)
            </span>
            <input
              type="text"
              value={parentKey}
              onChange={(e) => setParentKey(e.target.value.toUpperCase())}
              placeholder="AT-12"
              className="px-2 py-1 text-xs rounded"
              style={inputStyle}
            />
          </div>

          {/* Summary prefix */}
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Default summary prefix (optional)
            </span>
            <input
              type="text"
              value={summaryPrefix}
              onChange={(e) => setSummaryPrefix(e.target.value)}
              placeholder="[QA]"
              className="px-2 py-1 text-xs rounded"
              style={inputStyle}
            />
          </div>

          {/* Form actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-1.5 text-xs font-medium rounded"
              style={{
                background: canSave ? 'var(--chrome-blue)' : 'var(--chrome-surface)',
                color: canSave ? '#ffffff' : 'var(--chrome-text-secondary)',
                border: 'none',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={closeForm}
              className="px-3 py-1.5 text-xs rounded"
              style={ghostBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
