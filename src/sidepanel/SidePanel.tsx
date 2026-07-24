import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/globals.css';
import SingleMode from './SingleMode';
import BulkMode from './BulkMode';
import Settings from './Settings';
import Help from './Help';
import WorkflowsTab from './WorkflowsTab';
import WorkflowManager from './WorkflowManager';
import type { AuthConfig, Workflow, PanelMode } from '../types';
import { getLocal } from '../lib/storage';
import { removeLegacySyncWorkflows } from '../lib/workflows';

const TABS: { id: PanelMode; label: string }[] = [
  { id: 'single', label: 'Single Task' },
  { id: 'bulk', label: 'Bulk Upload' },
  { id: 'workflows', label: 'Workflows' },
];

function isTabMode(mode: PanelMode): mode is 'single' | 'bulk' | 'workflows' {
  return mode === 'single' || mode === 'bulk' || mode === 'workflows';
}

function SidePanel() {
  const [activeTab, setActiveTab] = useState<PanelMode>('single');
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkflowManager, setShowWorkflowManager] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | undefined>(undefined);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [domain, setDomain] = useState('');

  function loadWorkflows(preferId?: string) {
    getLocal<Workflow[]>('jirawm_workflows').then((wf) => {
      const list = wf ?? [];
      setWorkflows(list);
      if (preferId && list.some((w) => w.id === preferId)) {
        setSelectedWorkflowId(preferId);
      } else if (list.length > 0 && !selectedWorkflowId) {
        setSelectedWorkflowId(list[0].id);
      }
    });
  }

  useEffect(() => {
    loadWorkflows();
    removeLegacySyncWorkflows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verify stored auth on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [auth, accountId] = await Promise.all([
        getLocal<AuthConfig>('auth'),
        getLocal<string>('accountId'),
      ]);
      if (cancelled) return;
      const hasAuth = Boolean(
        auth &&
          auth.domain.trim() &&
          auth.email.trim() &&
          auth.apiToken.trim() &&
          accountId &&
          accountId.trim(),
      );
      setIsAuthed(hasAuth);
      setDomain(hasAuth && auth ? auth.domain : '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleWorkflowSaved(saved: Workflow) {
    setShowWorkflowManager(false);
    setEditingWorkflow(undefined);
    loadWorkflows(saved.id);
  }

  function handleWorkflowDeleted() {
    setShowWorkflowManager(false);
    setEditingWorkflow(undefined);
    loadWorkflows();
  }

  function handleBack() {
    setShowSettings(false);
    loadWorkflows();
    void (async () => {
      const [auth, accountId] = await Promise.all([
        getLocal<AuthConfig>('auth'),
        getLocal<string>('accountId'),
      ]);
      const hasAuth = Boolean(
        auth &&
          auth.domain.trim() &&
          auth.email.trim() &&
          auth.apiToken.trim() &&
          accountId &&
          accountId.trim(),
      );
      setIsAuthed(hasAuth);
      setDomain(hasAuth && auth ? auth.domain : '');
    })();
  }

  const hasWorkflows = workflows.length > 0;
  const showChrome = !showSettings && !showWorkflowManager && isTabMode(activeTab);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: 'var(--chrome-bg)', color: 'var(--chrome-text-primary)' }}
    >
      {/* ── Tab bar ── */}
      <div
        className="flex items-end shrink-0 px-3"
        style={{ borderBottom: '1px solid var(--chrome-border)' }}
      >
        {TABS.map(({ id, label }) => {
          const isActive = showChrome && activeTab === id;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowSettings(false); setShowWorkflowManager(false); }}
              style={{
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--chrome-blue)'
                  : '2px solid transparent',
                background: 'none',
                color: isActive ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                padding: '8px 0',
                marginRight: '16px',
              }}
            >
              {label}
            </button>
          );
        })}

        {/* Help + Settings — right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => { setActiveTab('help'); setShowSettings(false); setShowWorkflowManager(false); }}
            style={{
              border: 'none',
              borderBottom: activeTab === 'help'
                ? '2px solid var(--chrome-blue)'
                : '2px solid transparent',
              background: 'none',
              color: activeTab === 'help'
                ? 'var(--chrome-blue)'
                : 'var(--chrome-text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '8px 0',
            }}
          >
            Help
          </button>
          <button
            onClick={() => { setShowSettings((s) => !s); setShowWorkflowManager(false); }}
            aria-label="Settings"
            style={{
              border: 'none',
              borderBottom: showSettings
                ? '2px solid var(--chrome-blue)'
                : '2px solid transparent',
              background: 'none',
              color: showSettings ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>⚙</span>
          </button>
        </div>
      </div>

      {/* ── Workflow selector — sticky, always visible ── */}
      {showChrome && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0"
          style={{
            borderBottom: '1px solid var(--chrome-border)',
            background: 'var(--chrome-surface)',
          }}
        >
          {!isAuthed ? (
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: 'var(--chrome-red)' }}>⚠️ Connect Jira first</span>
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--chrome-blue)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Open Settings
              </button>
            </div>
          ) : (
            <>
              <span
                className="text-xs font-medium shrink-0"
                style={{ color: 'var(--chrome-text-secondary)' }}
              >
                Workflow:
              </span>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                disabled={!hasWorkflows}
                className="flex-1 text-xs rounded py-0.5 px-1"
                style={{
                  border: '1px solid var(--chrome-border)',
                  background: 'var(--chrome-bg)',
                  color: hasWorkflows
                    ? 'var(--chrome-text-primary)'
                    : 'var(--chrome-text-secondary)',
                  outline: 'none',
                }}
              >
                {hasWorkflows ? (
                  workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No workflows yet — create one
                  </option>
                )}
              </select>
              <button
                onClick={() => { setShowWorkflowManager(true); setShowSettings(false); setEditingWorkflow(undefined); }}
                className="shrink-0 text-xs rounded px-2 py-0.5 font-medium"
                style={{
                  border: '1px solid var(--chrome-blue)',
                  background: 'var(--chrome-bg)',
                  color: 'var(--chrome-blue)',
                  cursor: 'pointer',
                }}
              >
                + New
              </button>
              {hasWorkflows && (
                <button
                  onClick={() => {
                    const wf = workflows.find((w) => w.id === selectedWorkflowId);
                    setEditingWorkflow(wf);
                    setShowWorkflowManager(true);
                    setShowSettings(false);
                  }}
                  className="shrink-0 text-xs"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--chrome-blue)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Content area ── */}
      <main className="flex-1 overflow-y-auto">
        {showWorkflowManager ? (
          <WorkflowManager
            editWorkflow={editingWorkflow}
            onSaved={handleWorkflowSaved}
            onDeleted={handleWorkflowDeleted}
            onCancel={() => { setShowWorkflowManager(false); setEditingWorkflow(undefined); }}
            onOpenSettings={() => { setShowWorkflowManager(false); setShowSettings(true); }}
          />
        ) : showSettings ? (
          <Settings onBack={handleBack} />
        ) : activeTab === 'help' ? (
          <Help />
        ) : activeTab === 'workflows' ? (
          <WorkflowsTab
            workflows={workflows}
            isAuthed={isAuthed}
            onNewWorkflow={() => { setShowWorkflowManager(true); setShowSettings(false); setEditingWorkflow(undefined); }}
            onEditWorkflow={(wf) => { setEditingWorkflow(wf); setShowWorkflowManager(true); setShowSettings(false); }}
            onWorkflowsChanged={() => loadWorkflows()}
          />
        ) : activeTab === 'single' ? (
          <SingleMode
            workflows={workflows}
            selectedWorkflowId={selectedWorkflowId}
            isAuthed={isAuthed}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <BulkMode
            isAuthed={isAuthed}
            selectedWorkflowId={selectedWorkflowId}
            workflows={workflows}
            domain={domain}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanel />
    </StrictMode>
  );
}

export default SidePanel;
