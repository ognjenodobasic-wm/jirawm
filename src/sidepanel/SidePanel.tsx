import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/globals.css';
import SingleMode from './SingleMode';
import BulkMode from './BulkMode';
import Settings from './Settings';
import type { Workflow, PanelMode } from '../types';
import { getSync } from '../lib/storage';

const TABS: { id: PanelMode; label: string }[] = [
  { id: 'single', label: 'Single Task' },
  { id: 'bulk', label: 'Bulk Upload' },
];

function SidePanel() {
  const [activeTab, setActiveTab] = useState<PanelMode>('single');
  const [showSettings, setShowSettings] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  function loadWorkflows() {
    getSync<Workflow[]>('jirawm_workflows').then((wf) => {
      const list = wf ?? [];
      setWorkflows(list);
      if (list.length > 0 && !selectedWorkflowId) {
        setSelectedWorkflowId(list[0].id);
      }
    });
  }

  useEffect(() => {
    loadWorkflows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBack() {
    setShowSettings(false);
    loadWorkflows();
  }

  const hasWorkflows = workflows.length > 0;

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
          const isActive = !showSettings && activeTab === id;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowSettings(false); }}
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

        {/* Gear — right-aligned */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
          style={{
            border: 'none',
            borderBottom: showSettings
              ? '2px solid var(--chrome-blue)'
              : '2px solid transparent',
            background: 'none',
            color: showSettings ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '8px 0',
            marginLeft: 'auto',
          }}
        >
          ⚙
        </button>
      </div>

      {/* ── Workflow selector — sticky, always visible ── */}
      {!showSettings && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0"
          style={{
            borderBottom: '1px solid var(--chrome-border)',
            background: 'var(--chrome-surface)',
          }}
        >
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
              <option value="">No workflows yet</option>
            )}
          </select>
        </div>
      )}

      {/* ── Content area ── */}
      <main className="flex-1 overflow-y-auto">
        {showSettings ? (
          <Settings onBack={handleBack} />
        ) : activeTab === 'single' ? (
          <SingleMode workflows={workflows} selectedWorkflowId={selectedWorkflowId} />
        ) : (
          <BulkMode />
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
