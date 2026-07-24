import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AuthConfig, Workflow, IssueTypeMeta, JiraField, JiraUser } from '../types';
import { getLocal, setLocal } from '../lib/storage';
import { saveWorkflow, deleteWorkflow } from '../lib/workflows';
import { setAuth, getProjects, getIssueTypes, searchIssues, getAssignableUsers } from '../lib/jira';
import AssigneeSelect from './components/AssigneeSelect';

interface WorkflowManagerProps {
  editWorkflow?: Workflow;
  onSaved: (workflow: Workflow) => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  onDeleted?: () => void;
}

type ProjectsState =
  | { status: 'loading' }
  | { status: 'noauth' }
  | { status: 'ready'; projects: Array<{ id: string; key: string; name: string }> }
  | { status: 'error'; message: string };

type IssueTypesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; issueTypes: IssueTypeMeta[] }
  | { status: 'error'; message: string };

type ParentSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; issues: Array<{ key: string; summary: string }> }
  | { status: 'error'; message: string };

// Fields handled by the app or by Jira itself — never shown as user-set defaults.
const EXCLUDED_FIELD_IDS = new Set([
  'project',
  'issuetype',
  'summary',
  'description',
  'parent',
  'attachment',
  'reporter',
  'assignee',
]);

const inputStyle: CSSProperties = {
  border: '1px solid var(--chrome-border)',
  background: 'var(--chrome-bg)',
  color: 'var(--chrome-text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '12px',
  borderRadius: '4px',
  padding: '4px 6px',
};

const labelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--chrome-text-secondary)',
  marginBottom: '2px',
  display: 'block',
};

const ghostBtn: CSSProperties = {
  border: '1px solid var(--chrome-border)',
  background: 'var(--chrome-bg)',
  color: 'var(--chrome-text-secondary)',
  cursor: 'pointer',
};

export default function WorkflowManager({ editWorkflow, onSaved, onCancel, onOpenSettings, onDeleted }: WorkflowManagerProps) {
  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: 'loading' });
  const [issueTypesState, setIssueTypesState] = useState<IssueTypesState>({ status: 'idle' });

  const [projectKey, setProjectKey] = useState('');
  const [issueTypeName, setIssueTypeName] = useState('');

  const [hasParent, setHasParent] = useState(false);
  const [parentKey, setParentKey] = useState('');
  const [parentQuery, setParentQuery] = useState('');
  const [selectedParentSummary, setSelectedParentSummary] = useState('');
  const [parentSearchState, setParentSearchState] = useState<ParentSearchState>({ status: 'idle' });
  const parentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [requiredDefaults, setRequiredDefaults] = useState<Record<string, string>>({});
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());
  const [optionalDefaults, setOptionalDefaults] = useState<Record<string, string>>({});
  const [defaultAssignee, setDefaultAssignee] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEditMode = Boolean(editWorkflow);

  // Step 1 — load projects (requires auth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await getLocal<AuthConfig>('auth');
      if (cancelled) return;
      if (!auth) {
        setProjectsState({ status: 'noauth' });
        return;
      }
      setAuth(auth);
      try {
        const projects = await getProjects();
        if (!cancelled) {
          setProjectsState({ status: 'ready', projects });
          if (editWorkflow && projects.some((p) => p.key === editWorkflow.projectKey)) {
            setProjectKey(editWorkflow.projectKey);
            setName(editWorkflow.name);
            setHasParent(editWorkflow.hasParent);
            setParentKey(editWorkflow.parentKey ?? '');
            setRequiredDefaults(editWorkflow.requiredFieldDefaults);
            setSelectedOptionalIds(new Set(editWorkflow.optionalFields.map((o) => o.fieldId)));
            const optDefaults: Record<string, string> = {};
            for (const opt of editWorkflow.optionalFields) {
              if (opt.defaultValue) optDefaults[opt.fieldId] = opt.defaultValue;
            }
            setOptionalDefaults(optDefaults);
            setDefaultAssignee(editWorkflow.defaultAssignee ?? null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setProjectsState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editWorkflow]);

  // Pre-select issue type once issue types load in edit mode.
  useEffect(() => {
    if (!editWorkflow || issueTypesState.status !== 'ready') return;
    if (issueTypesState.issueTypes.some((it) => it.name === editWorkflow.issueType)) {
      setIssueTypeName(editWorkflow.issueType);
    }
  }, [editWorkflow, issueTypesState]);

  // Step 2 — load issue types and assignable users when a project is selected
  useEffect(() => {
    if (!projectKey) {
      setIssueTypesState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setIssueTypesState({ status: 'loading' });

    getIssueTypes(projectKey)
      .then((issueTypes) => {
        if (!cancelled) setIssueTypesState({ status: 'ready', issueTypes });
      })
      .catch((err) => {
        if (!cancelled) {
          setIssueTypesState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });

    getAssignableUsers(projectKey)
      .then((users) => {
        if (!cancelled) {
          void setLocal<JiraUser[]>(`assignableUsers_${projectKey}`, users);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load assignable users:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const selectedIssueType: IssueTypeMeta | null =
    issueTypesState.status === 'ready'
      ? (issueTypesState.issueTypes.find((it) => it.name === issueTypeName) ?? null)
      : null;

  const requiredFields: JiraField[] = selectedIssueType
    ? selectedIssueType.fields.filter((f) => f.required && !EXCLUDED_FIELD_IDS.has(f.id))
    : [];
  const optionalFields: JiraField[] = selectedIssueType
    ? selectedIssueType.fields.filter((f) => !f.required && !EXCLUDED_FIELD_IDS.has(f.id))
    : [];

  function handleProjectChange(key: string) {
    setProjectKey(key);
    setIssueTypeName('');
    setParentKey('');
    setParentQuery('');
    setSelectedParentSummary('');
    setParentSearchState({ status: 'idle' });
    setRequiredDefaults({});
    setSelectedOptionalIds(new Set());
    setOptionalDefaults({});
    setDefaultAssignee(null);
  }

  function handleIssueTypeChange(typeName: string) {
    setIssueTypeName(typeName);
    setRequiredDefaults({});
    setSelectedOptionalIds(new Set());
    setOptionalDefaults({});
  }

  function toggleOptional(fieldId: string) {
    setSelectedOptionalIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  function clearParent() {
    setParentKey('');
    setSelectedParentSummary('');
    setParentQuery('');
    setParentSearchState({ status: 'idle' });
  }

  function selectParent(key: string, summary: string) {
    setParentKey(key);
    setSelectedParentSummary(summary);
    setParentQuery('');
    setParentSearchState({ status: 'idle' });
  }

  function handleParentQueryChange(value: string) {
    setParentQuery(value);
    setParentSearchState({ status: 'idle' });

    if (parentSearchTimer.current) {
      clearTimeout(parentSearchTimer.current);
      parentSearchTimer.current = null;
    }

    if (value.trim().length < 2) return;

    parentSearchTimer.current = setTimeout(async () => {
      const projectId =
        projectsState.status === 'ready'
          ? projectsState.projects.find((p) => p.key === projectKey)?.id
          : undefined;
      if (!projectId) return;

      setParentSearchState({ status: 'loading' });
      try {
        const issues = await searchIssues(value.trim(), projectId);
        setParentSearchState({ status: 'ready', issues });
      } catch (err) {
        setParentSearchState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }, 400);
  }

  async function handleSave() {
    setSaveError('');
    if (!name.trim() || !projectKey || !issueTypeName || !selectedIssueType) return;

    const projects = projectsState.status === 'ready' ? projectsState.projects : [];
    const projectName = projects.find((p) => p.key === projectKey)?.name ?? projectKey;

    const workflow: Workflow = {
      id: editWorkflow?.id ?? crypto.randomUUID(),
      name: name.trim(),
      projectKey,
      projectName,
      issueType: issueTypeName,
      hasParent,
      parentKey: hasParent ? parentKey.trim() : undefined,
      defaultAssignee,
      compression: { quality: 0.85, maxWidth: 1920 },
      requiredFieldDefaults: requiredDefaults,
      optionalFields: [...selectedOptionalIds].map((fieldId) => ({
        fieldId,
        defaultValue: optionalDefaults[fieldId] || undefined,
      })),
      fieldMeta: selectedIssueType.fields,
    };

    try {
      await saveWorkflow(workflow);
      onSaved(workflow);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }

  const canSave = Boolean(name.trim() && projectKey && issueTypeName);

  async function handleDelete() {
    if (!editWorkflow) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteWorkflow(editWorkflow.id);
      onDeleted?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }

  // ── Auth gate ──
  if (projectsState.status === 'noauth') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <span className="text-sm font-semibold">{isEditMode ? 'Edit Workflow' : 'New Workflow'}</span>
        <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          Connect Jira first to load your projects.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-xs font-medium rounded"
            style={{ background: 'var(--chrome-blue)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Open Settings
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded" style={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{isEditMode ? 'Edit Workflow' : 'New Workflow'}</span>
        <button onClick={onCancel} className="px-2 py-0.5 text-xs rounded" style={ghostBtn}>
          Cancel
        </button>
      </div>

      {/* Step 1 — Project */}
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Project *</label>
        {projectsState.status === 'loading' && (
          <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
            Loading projects…
          </p>
        )}
        {projectsState.status === 'error' && (
          <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
            ✗ {projectsState.message}
          </p>
        )}
        {projectsState.status === 'ready' && (
          <select
            value={projectKey}
            onChange={(e) => handleProjectChange(e.target.value)}
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

      {/* Step 2 — Parent */}
      {projectKey && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasParent}
              onChange={(e) => setHasParent(e.target.checked)}
            />
            <span className="text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
              Create all tasks as subtasks of a parent
            </span>
          </label>
          {hasParent && (
            <div className="flex flex-col gap-1 relative">
              <label style={labelStyle}>Parent issue</label>
              {parentKey ? (
                <div
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
                  style={{
                    border: '1px solid var(--chrome-border)',
                    background: 'var(--chrome-surface)',
                    color: 'var(--chrome-text-primary)',
                  }}
                >
                  <span className="truncate">
                    {parentKey} — {selectedParentSummary}
                  </span>
                  <button
                    type="button"
                    onClick={clearParent}
                    className="shrink-0"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--chrome-red)',
                      fontSize: '14px',
                      lineHeight: 1,
                    }}
                    aria-label="Clear parent"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={parentQuery}
                    onChange={(e) => handleParentQueryChange(e.target.value)}
                    placeholder="Search parent issue…"
                    style={inputStyle}
                  />
                  {parentSearchState.status === 'loading' && (
                    <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                      Searching…
                    </p>
                  )}
                  {parentSearchState.status === 'error' && (
                    <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
                      ✗ {parentSearchState.message}
                    </p>
                  )}
                  {parentSearchState.status === 'ready' && (
                    <div
                      className="flex flex-col rounded overflow-hidden"
                      style={{
                        border: '1px solid var(--chrome-border)',
                        background: 'var(--chrome-bg)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                      }}
                    >
                      {parentSearchState.issues.filter((item) => {
                        const q = parentQuery.toLowerCase();
                        return item.key.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
                      }).length === 0 ? (
                        <div
                          className="px-2 py-1.5 text-xs"
                          style={{ color: 'var(--chrome-text-secondary)' }}
                        >
                          No issues found
                        </div>
                      ) : (
                        parentSearchState.issues
                          .filter((item) => {
                            const q = parentQuery.toLowerCase();
                            return item.key.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
                          })
                          .map((issue) => (
                            <button
                              key={issue.key}
                              type="button"
                              onClick={() => selectParent(issue.key, issue.summary)}
                              className="text-left px-2 py-1.5 text-xs"
                              style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: '1px solid var(--chrome-border)',
                                cursor: 'pointer',
                                color: 'var(--chrome-text-primary)',
                              }}
                            >
                              {issue.key} — {issue.summary}
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Default assignee */}
      {projectKey && (
        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Default assignee</label>
          <AssigneeSelect
            projectKey={projectKey}
            value={defaultAssignee}
            onChange={setDefaultAssignee}
          />
        </div>
      )}

      {/* Step 4 — Issue type */}
      {projectKey && (
        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Issue type *</label>
          {issueTypesState.status === 'loading' && (
            <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              Loading issue types…
            </p>
          )}
          {issueTypesState.status === 'error' && (
            <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
              ✗ {issueTypesState.message}
            </p>
          )}
          {issueTypesState.status === 'ready' && (
            <select
              value={issueTypeName}
              onChange={(e) => handleIssueTypeChange(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select an issue type…</option>
              {issueTypesState.issueTypes.map((it) => (
                <option key={it.id} value={it.name}>
                  {it.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Step 5 — Required field defaults */}
      {selectedIssueType && requiredFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--chrome-text-secondary)' }}>
            REQUIRED FIELDS
          </span>
          {requiredFields.map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <label style={labelStyle}>{f.name}</label>
              <input
                type="text"
                value={requiredDefaults[f.id] ?? ''}
                onChange={(e) =>
                  setRequiredDefaults((prev) => ({ ...prev, [f.id]: e.target.value }))
                }
                placeholder={`Default ${f.name.toLowerCase()}`}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 6 — Optional fields */}
      {selectedIssueType && optionalFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--chrome-text-secondary)' }}>
            OPTIONAL FIELDS
          </span>
          {optionalFields.map((f) => {
            const checked = selectedOptionalIds.has(f.id);
            return (
              <div key={f.id} className="flex flex-col gap-1">
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOptional(f.id)} />
                  <span className="text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    {f.name}
                  </span>
                </label>
                {checked && (
                  <input
                    type="text"
                    value={optionalDefaults[f.id] ?? ''}
                    onChange={(e) =>
                      setOptionalDefaults((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                    placeholder={`Default ${f.name.toLowerCase()}`}
                    style={inputStyle}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Final — Name + Save */}
      {selectedIssueType && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>Workflow name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="QA Bug Report"
              style={inputStyle}
            />
          </div>

          {saveError && (
            <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
              ✗ {saveError}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave}
            className="py-1.5 text-xs font-medium rounded"
            style={{
              background: canSave ? 'var(--chrome-blue)' : 'var(--chrome-surface)',
              color: canSave ? '#fff' : 'var(--chrome-text-secondary)',
              border: 'none',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Save Workflow
          </button>

          {isEditMode && (
            <button
              onClick={handleDelete}
              className="w-full py-1.5 text-xs font-medium rounded"
              style={{
                background: confirmDelete ? 'var(--chrome-red)' : 'var(--chrome-bg)',
                color: confirmDelete ? '#fff' : 'var(--chrome-red)',
                border: '1px solid var(--chrome-red)',
                cursor: 'pointer',
              }}
            >
              {confirmDelete ? 'Are you sure? Click again to delete' : 'Delete Workflow'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
