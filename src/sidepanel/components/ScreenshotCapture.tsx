import { useEffect, useState } from 'react';
import type { AppSettings, ScreenshotItem, Workflow } from '../../types';
import { useScreenshotCapture } from '../single/useScreenshotCapture';
import { useAnnotationEditor } from '../single/useAnnotationEditor';
import ScreenshotStrip from '../single/ScreenshotStrip';
import { getAppSettings } from '../../lib/storage';

interface ScreenshotCaptureProps {
  screenshots: ScreenshotItem[];
  onChange: (screenshots: ScreenshotItem[]) => void;
  maxScreenshots?: number;
  activeWorkflow?: Workflow | null;
  isLoading?: boolean;
  onOpenSettings?: () => void;
  onError?: (message: string) => void;
  onResetResult?: () => void;
  renderItemFooter?: (item: ScreenshotItem, index: number) => React.ReactNode;
}

export default function ScreenshotCapture({
  screenshots,
  onChange,
  activeWorkflow = null,
  isLoading = false,
  onOpenSettings = () => {},
  onError,
  onResetResult,
  renderItemFooter,
}: ScreenshotCaptureProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getAppSettings().then(setAppSettings);
  }, []);

  const setScreenshots = (next: ScreenshotItem[] | ((prev: ScreenshotItem[]) => ScreenshotItem[])) => {
    const resolved = typeof next === 'function' ? next(screenshots) : next;
    onChange(resolved);
  };

  const {
    fileInputRef,
    capturePermission,
    permissionMessage,
    handleCapture,
    handleFileSelect,
    handleFiles,
    handleRemove: removeScreenshot,
    resetCounter: _resetCounter,
  } = useScreenshotCapture({
    screenshots,
    setScreenshots,
    setSelectedId,
    setResultKey: (next) => { if (next === null) onResetResult?.(); },
    setAttachFailed: (next) => { if (!next) onResetResult?.(); },
    setError: (msg) => { if (msg !== null) onError?.(msg); },
    activeWorkflow,
    appSettings,
  });

  const { openEditor } = useAnnotationEditor({ screenshots, setScreenshots, appSettings });

  function handleRemove(id: string) {
    removeScreenshot(id);
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <>
      <ScreenshotStrip
        screenshots={screenshots}
        selectedId={selectedId}
        isLoading={isLoading}
        capturePermission={capturePermission}
        fileInputRef={fileInputRef}
        onCapture={() => { void handleCapture(); }}
        onFileSelect={handleFileSelect}
        onOpenEditor={(index) => { void openEditor(index); }}
        onRemove={(id) => setPendingRemoveId(id)}
        onOpenSettings={onOpenSettings}
        renderItemFooter={renderItemFooter}
        onFilesDrop={(files) => { void handleFiles(files); }}
      />

      {permissionMessage && (
        <div className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          {permissionMessage}
        </div>
      )}

      {pendingRemoveId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--chrome-bg)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 8,
              padding: 20,
              minWidth: 280,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--chrome-text-primary)', margin: '0 0 16px' }}>
              Remove this screenshot? This can't be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setPendingRemoveId(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid var(--chrome-border)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRemove(pendingRemoveId);
                  setPendingRemoveId(null);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--chrome-red)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
