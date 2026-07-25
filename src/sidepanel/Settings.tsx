import { useState, useEffect, useRef, useCallback } from 'react';
import type { AuthConfig, AppSettings } from '../types';
import { getLocal, setLocal, getAppSettings, saveAppSettings } from '../lib/storage';
import { setAuth, testConnection } from '../lib/jira';
import { hasCapturePermission, requestCapturePermission } from '../lib/permissions';
import Accordion from './components/Accordion';
import Tooltip from './components/Tooltip';

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

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sectionSaved, setSectionSaved] = useState<Record<string, boolean>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getLocal<AuthConfig>('auth').then((saved) => {
      if (!saved) return;
      setDomain(saved.domain);
      setEmail(saved.email);
      setApiToken(saved.apiToken);
    });
    getAppSettings().then(setSettings);
  }, []);

  const scheduleSave = useCallback((section: string, next: AppSettings) => {
    setSettings(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveAppSettings(next);
      setSectionSaved((prev) => ({ ...prev, [section]: true }));
      setTimeout(() => {
        setSectionSaved((prev) => ({ ...prev, [section]: false }));
      }, 1500);
    }, 400);
  }, []);

  const [capturePermission, setCapturePermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasCapturePermission().then(setCapturePermission).catch(() => setCapturePermission(false));
  }, []);

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

  if (!settings) {
    return (
      <div
        className="flex flex-col h-full items-center justify-center"
        style={{ background: 'var(--chrome-bg)', color: 'var(--chrome-text-primary)' }}
      >
        <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          Loading settings…
        </span>
      </div>
    );
  }

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
        <span className="text-sm font-semibold">Settings</span>
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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--chrome-text-secondary)' }}>
                API token
              </span>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-xs"
                style={{
                  color: 'var(--chrome-text-secondary)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                Generate token
              </a>
            </div>
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

        {/* Accordions */}
        <div
          className="rounded p-2 space-y-2"
          style={{ border: '1px solid var(--chrome-border)', background: 'var(--chrome-surface)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--chrome-text-primary)' }}>
                Page access
              </span>
              <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                Needed to take screenshots. File uploads work without it.
              </span>
            </div>
            {capturePermission === null ? (
              <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>Checking…</span>
            ) : capturePermission ? (
              <span className="text-xs" style={{ color: 'var(--chrome-green)' }}>Granted</span>
            ) : (
              <button
                type="button"
                onClick={() => { requestCapturePermission().then(setCapturePermission); }}
                className="text-xs rounded px-2 py-1"
                style={{
                  border: 'none',
                  background: 'var(--chrome-blue)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Grant
              </button>
            )}
          </div>
        </div>

        <Accordion
          title="Image handling"
          tooltip="Every image is converted to JPEG when it enters the extension. These settings control that conversion."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                  Quality
                </label>
                <Tooltip text="Applies only when an image enters the extension. Annotations and crops are always saved at maximum quality, so editing never degrades an image twice." />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.6}
                  max={1}
                  step={0.05}
                  value={settings.image.quality}
                  onChange={(e) =>
                    scheduleSave('image', {
                      ...settings,
                      image: { ...settings.image, quality: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1"
                />
                <span className="text-xs" style={{ color: 'var(--chrome-text-primary)', minWidth: 36, textAlign: 'right' }}>
                  {settings.image.quality.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                Max width (px)
              </label>
              <input
                type="number"
                min={800}
                max={3840}
                value={settings.image.maxWidth}
                onChange={(e) =>
                  scheduleSave('image', {
                    ...settings,
                    image: { ...settings.image, maxWidth: parseInt(e.target.value, 10) || 1920 },
                  })
                }
                className="px-2 py-1 text-sm rounded"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
                  Transparent background fill
                </span>
                <Tooltip text="JPEG has no transparency. PNGs with transparent areas get this colour instead. White matches most screenshots; black suits dark-mode UIs." />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                  <input
                    type="radio"
                    name="transparencyFill"
                    checked={settings.image.transparencyFill === 'white'}
                    onChange={() =>
                      scheduleSave('image', {
                        ...settings,
                        image: { ...settings.image, transparencyFill: 'white' },
                      })
                    }
                  />
                  White
                </label>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                  <input
                    type="radio"
                    name="transparencyFill"
                    checked={settings.image.transparencyFill === 'black'}
                    onChange={() =>
                      scheduleSave('image', {
                        ...settings,
                        image: { ...settings.image, transparencyFill: 'black' },
                      })
                    }
                  />
                  Black
                </label>
              </div>
            </div>

            {sectionSaved['image'] && (
              <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>Saved</p>
            )}
          </div>
        </Accordion>

        <Accordion
          title="Screenshot naming"
          tooltip="Numbered attachments let you point at a specific image from the task description."
        >
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
              <input
                type="checkbox"
                checked={settings.naming.numberSingleScreenshots}
                onChange={(e) =>
                  scheduleSave('naming', {
                    ...settings,
                    naming: { ...settings.naming, numberSingleScreenshots: e.target.checked },
                  })
                }
              />
              <span>
                Number screenshots in single tasks
                <span className="block" style={{ color: 'var(--chrome-text-secondary)', marginTop: 2 }}>
                  Attachments are named 1.jpg, 2.jpg.
                </span>
                <span className="block" style={{ color: 'var(--chrome-text-secondary)', marginTop: 2 }}>
                  <Tooltip text="Numbers are never reused. If you delete the second screenshot, the next one you take is 4 — so anything already written referring to an image stays correct." />
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
              <input
                type="checkbox"
                checked={settings.naming.numberBulkFiles}
                onChange={(e) =>
                  scheduleSave('naming', {
                    ...settings,
                    naming: { ...settings.naming, numberBulkFiles: e.target.checked },
                  })
                }
              />
              <span>
                Number files in bulk upload
                <span className="block" style={{ color: 'var(--chrome-text-secondary)', marginTop: 2 }}>
                  Prefixes uploaded filenames, e.g. 1 - login-error.jpg
                </span>
              </span>
            </label>

            {sectionSaved['naming'] && (
              <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>Saved</p>
            )}
          </div>
        </Accordion>

        <Accordion
          title="Capture details"
          tooltip="A short block describing the conditions the screenshot was taken in."
        >
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
              <input
                type="checkbox"
                checked={settings.captureDetails.enabled}
                onChange={(e) =>
                  scheduleSave('captureDetails', {
                    ...settings,
                    captureDetails: { ...settings.captureDetails, enabled: e.target.checked },
                  })
                }
              />
              <span>
                Add capture details to description
                <span className="block" style={{ color: 'var(--chrome-text-secondary)', marginTop: 2 }}>
                  Only applies to screenshots taken with the extension, never to uploaded files.
                </span>
                <span className="block" style={{ color: 'var(--chrome-text-secondary)', marginTop: 2 }}>
                  <Tooltip text="These details are not typed into the description box — they are generated and merged into the description when the task is created. You cannot edit them, and they always match the screenshots actually attached." />
                </span>
              </span>
            </label>

            {settings.captureDetails.enabled && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>Position</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                      <input
                        type="radio"
                        name="metadataPosition"
                        checked={settings.captureDetails.position === 'bottom'}
                        onChange={() =>
                          scheduleSave('captureDetails', {
                            ...settings,
                            captureDetails: { ...settings.captureDetails, position: 'bottom' },
                          })
                        }
                      />
                      End of description
                    </label>
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                      <input
                        type="radio"
                        name="metadataPosition"
                        checked={settings.captureDetails.position === 'top'}
                        onChange={() =>
                          scheduleSave('captureDetails', {
                            ...settings,
                            captureDetails: { ...settings.captureDetails, position: 'top' },
                          })
                        }
                      />
                      Start of description
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pl-4" style={{ borderLeft: '2px solid var(--chrome-border)' }}>
                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.captureDetails.includeUrl}
                      onChange={(e) =>
                        scheduleSave('captureDetails', {
                          ...settings,
                          captureDetails: { ...settings.captureDetails, includeUrl: e.target.checked },
                        })
                      }
                    />
                    Page URL
                  </label>

                  {settings.captureDetails.includeUrl && (
                    <label className="flex items-center gap-2 text-xs pl-5" style={{ color: 'var(--chrome-text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={settings.captureDetails.stripQueryParams}
                        onChange={(e) =>
                          scheduleSave('captureDetails', {
                            ...settings,
                            captureDetails: { ...settings.captureDetails, stripQueryParams: e.target.checked },
                          })
                        }
                      />
                      Strip query parameters from URL
                      <Tooltip text="Removes everything after the ? — URLs often carry session tokens you do not want pasted into a ticket." />
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.captureDetails.includePageTitle}
                      onChange={(e) =>
                        scheduleSave('captureDetails', {
                          ...settings,
                          captureDetails: { ...settings.captureDetails, includePageTitle: e.target.checked },
                        })
                      }
                    />
                    Page title
                  </label>

                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.captureDetails.includeTimestamp}
                      onChange={(e) =>
                        scheduleSave('captureDetails', {
                          ...settings,
                          captureDetails: { ...settings.captureDetails, includeTimestamp: e.target.checked },
                        })
                      }
                    />
                    Timestamp
                  </label>

                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.captureDetails.includeViewport}
                      onChange={(e) =>
                        scheduleSave('captureDetails', {
                          ...settings,
                          captureDetails: { ...settings.captureDetails, includeViewport: e.target.checked },
                        })
                      }
                    />
                    Viewport and zoom
                    <Tooltip text="Measured from the screenshot itself, so it reflects the page area as captured. Note that an open side panel narrows the page, so this is the width with the panel open." />
                  </label>

                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--chrome-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.captureDetails.includeBrowser}
                      onChange={(e) =>
                        scheduleSave('captureDetails', {
                          ...settings,
                          captureDetails: { ...settings.captureDetails, includeBrowser: e.target.checked },
                        })
                      }
                    />
                    Browser and OS
                  </label>
                </div>
              </>
            )}

            {sectionSaved['captureDetails'] && (
              <p className="text-xs" style={{ color: 'var(--chrome-green)' }}>Saved</p>
            )}
          </div>
        </Accordion>
      </div>
    </div>
  );
}
