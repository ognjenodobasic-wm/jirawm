import { useState, useEffect, useRef } from 'react';
import type { AuthConfig, Workflow, ExportSnapshot, CompressionSettings } from '../types';
import { getLocal, setLocal, getSync, setSync } from '../lib/storage';
import { setAuth, testConnection } from '../lib/jira';
import { WORKFLOWS_KEY, SNAPSHOT_KEY } from '../lib/workflows';

interface SettingsProps {
  onBack: () => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; displayName: string; accountId: string }
  | { status: 'error'; message: string };

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--chrome-border)',
  background: 'var(--chrome-surface)',
  color: 'var(--chrome-text-primary)',
  outline: 'none',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: 'var(--chrome-text-secondary)',
};

export default function Settings({ onBack }: SettingsProps) {
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [exportImportMessage, setExportImportMessage] = useState<string | null>(null);
  const [exportImportError, setExportImportError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ExportSnapshot | null>(null);
  const [compression, setCompression] = useState<CompressionSettings>({ quality: 0.85, maxWidth: 1920 });
  const [compressionSaved, setCompressionSaved] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLocal<AuthConfig>('auth').then((saved) => {
      if (!saved) return;
      setDomain(saved.domain);
      setEmail(saved.email);
      setApiToken(saved.apiToken);
    });
    getLocal<ExportSnapshot>(SNAPSHOT_KEY).then((s) => setSnapshot(s));
    getLocal<CompressionSettings>('jirawm_compression').then((c) => {
      if (c) setCompression(c);
    });
  }, []);

  async function handleSaveCompression() {
    await setLocal('jirawm_compression', compression);
    setCompressionSaved(true);
    setTimeout(() => setCompressionSaved(false), 2000);
  }

  async function handleExport() {
    setExportImportMessage(null);
    setExportImportError(null);
    try {
      const workflows = (await getSync<Workflow[]>(WORKFLOWS_KEY)) ?? [];
      const json = JSON.stringify(workflows, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workflows-jirawm.json';
      a.click();
      URL.revokeObjectURL(url);

      const snap: ExportSnapshot = {
        timestamp: new Date().toISOString(),
        count: workflows.length,
        names: workflows.map((w) => w.name),
      };
      await setLocal(SNAPSHOT_KEY, snap);
      setSnapshot(snap);
      setExportImportMessage(`Exported ${workflows.length} workflows`);
    } catch (err) {
      setExportImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setExportImportMessage(null);
    setExportImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const imported: unknown = JSON.parse(text);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid workflow file: expected a JSON array.');
      }

      const existing = (await getSync<Workflow[]>(WORKFLOWS_KEY)) ?? [];
      const merged = [...existing];
      let newCount = 0;
      let updatedCount = 0;

      for (const item of imported) {
        const w = item as Workflow;
        if (!w.id || !w.name) {
          throw new Error('Invalid workflow entry: missing id or name.');
        }
        const idx = merged.findIndex((e) => e.id === w.id);
        if (idx >= 0) {
          merged[idx] = w;
          updatedCount++;
        } else {
          merged.push(w);
          newCount++;
        }
      }

      await setSync(WORKFLOWS_KEY, merged);
      setExportImportMessage(`Imported ${merged.length} workflows (${newCount} new, ${updatedCount} updated)`);
    } catch (err) {
      setExportImportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSave() {
    if (!domain.trim() || !email.trim() || !apiToken.trim()) {
      setValidationError('All fields are required.');
      return;
    }
    setValidationError('');
    setTestState({ status: 'loading' });

    const config: AuthConfig = {
      domain: domain.trim(),
      email: email.trim(),
      apiToken: apiToken.trim(),
      accountId: '',
    };

    await setLocal('auth', config);
    setAuth(config);

    try {
      const { accountId, displayName } = await testConnection();
      const updated: AuthConfig = { ...config, accountId };
      await setLocal('auth', updated);
      await setLocal('accountId', accountId);
      setTestState({ status: 'ok', displayName, accountId });
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const isSaving = testState.status === 'loading';

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--chrome-bg)', color: 'var(--chrome-text-primary)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--chrome-border)' }}
      >
        <button
          onClick={onBack}
          className="text-xs"
          style={{ color: 'var(--chrome-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← Back
        </button>
        <span className="text-sm font-semibold">Jira Connection</span>
      </div>

      <div className="flex flex-col gap-4 p-3 flex-1 overflow-y-auto">
        {/* Auth */}
        <div className="flex flex-col gap-4">
          <span style={sectionTitleStyle}>Jira Connection</span>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--chrome-text-secondary)' }}>
              Jira domain
            </span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mycompany"
                disabled={isSaving}
                className="flex-1 px-2 py-1 text-sm rounded"
                style={inputStyle}
              />
              <span className="text-xs shrink-0" style={{ color: 'var(--chrome-text-secondary)' }}>
                .atlassian.net
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--chrome-text-secondary)' }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSaving}
              className="px-2 py-1 text-sm rounded"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--chrome-text-secondary)' }}>
              API token
            </span>
            <div className="flex items-center gap-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSaving}
                className="flex-1 px-2 py-1 text-sm rounded"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="px-2 py-1 text-xs rounded shrink-0"
                style={{
                  border: '1px solid var(--chrome-border)',
                  background: 'var(--chrome-surface)',
                  color: 'var(--chrome-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {validationError && (
            <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
              {validationError}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium rounded"
            style={{
              background: isSaving ? 'var(--chrome-surface)' : 'var(--chrome-blue)',
              color: isSaving ? 'var(--chrome-text-secondary)' : '#ffffff',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? 'Connecting…' : 'Save & Test Connection'}
          </button>

          {testState.status === 'ok' && (
            <div
              className="flex flex-col gap-0.5 p-2 rounded text-xs"
              style={{ background: 'var(--chrome-surface)', border: '1px solid var(--chrome-border)' }}
            >
              <span style={{ color: 'var(--chrome-green)' }}>✓ Connected</span>
              <span style={{ color: 'var(--chrome-text-primary)' }}>{testState.displayName}</span>
              <span style={{ color: 'var(--chrome-text-secondary)' }}>
                Account ID: {testState.accountId}
              </span>
            </div>
          )}

          {testState.status === 'error' && (
            <div
              className="p-2 rounded text-xs"
              style={{
                background: 'var(--chrome-surface)',
                border: '1px solid var(--chrome-red)',
                color: 'var(--chrome-red)',
              }}
            >
              ✗ {testState.message}
            </div>
          )}
        </div>

        {/* Compression */}
        <div className="flex flex-col gap-4">
          <span style={sectionTitleStyle}>Screenshot Quality</span>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                  JPEG quality
                </label>
                <span className="text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                  {Math.round(compression.quality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={compression.quality}
                onChange={(e) => setCompression((prev) => ({ ...prev, quality: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                Max width (px)
              </label>
              <input
                type="number"
                min={800}
                max={3840}
                value={compression.maxWidth}
                onChange={(e) => setCompression((prev) => ({ ...prev, maxWidth: parseInt(e.target.value, 10) || 1920 }))}
                className="px-2 py-1 text-sm rounded"
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleSaveCompression}
              className="px-3 py-1.5 text-sm font-medium rounded"
              style={{
                background: 'var(--chrome-blue)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save Compression
            </button>
            {compressionSaved && (
              <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>
                Compression saved
              </p>
            )}
          </div>
        </div>

        {/* Keyboard shortcut */}
        <div className="flex flex-col gap-4">
          <span style={sectionTitleStyle}>Keyboard Shortcut</span>
          <div className="flex flex-col gap-1">
            <p className="text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
              Ctrl+Shift+S (Windows) / Cmd+Shift+S (Mac)
            </p>
            <button
              onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              className="text-xs self-start"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--chrome-blue)',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Change shortcut
            </button>
          </div>
        </div>

        {/* Export / Import */}
        <div className="flex flex-col gap-4">
          <span style={sectionTitleStyle}>Workflows</span>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded"
                style={{
                  border: '1px solid var(--chrome-border)',
                  background: 'var(--chrome-bg)',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Export Workflows
              </button>
              <button
                onClick={handleImportClick}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded"
                style={{
                  border: '1px solid var(--chrome-border)',
                  background: 'var(--chrome-bg)',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Import Workflows
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>

            {exportImportMessage && (
              <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>
                {exportImportMessage}
              </p>
            )}
            {exportImportError && (
              <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
                ✗ {exportImportError}
              </p>
            )}

            <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
              {snapshot ? (
                <span>
                  Last export: {new Date(snapshot.timestamp).toLocaleString()} — {snapshot.count} workflows: {snapshot.names.join(', ')}
                </span>
              ) : (
                <span>No export yet</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
