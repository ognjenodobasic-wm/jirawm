import { useEffect } from 'react';
import type { PendingEditor } from '../types';
import { buildCaptureDetailFields } from '../lib/capture-adf';
import CaptureDetailsPanel from './CaptureDetailsPanel';

interface Props {
  pending: PendingEditor;
  onAnnotate: () => void;
  onClose: () => Promise<void>;
}

const TOOLBAR_HEIGHT = 44;

export default function PreviewMode({ pending, onAnnotate, onClose }: Props) {
  const { dataUrl, screenshotId, origin, metadata, metadataOverrides, captureDetailsSettings } = pending;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') void onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const panelConditions =
    origin === 'capture' &&
    metadata !== null &&
    captureDetailsSettings !== null &&
    captureDetailsSettings.enabled;

  const fields =
    panelConditions
      ? buildCaptureDetailFields(
          {
            id: screenshotId,
            dataUrl: '',
            origin: 'capture',
            metadata: metadata!,
            metadataOverrides,
            number: null,
            filename: '',
          },
          captureDetailsSettings!,
        )
      : [];

  const showPanel = panelConditions && fields.length > 0;
  const allowEdit = captureDetailsSettings?.allowPerScreenshotEdit ?? false;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#1a1a2e',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: TOOLBAR_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
          background: 'var(--chrome-surface)',
          borderBottom: '1px solid var(--chrome-border)',
          gap: 8,
        }}
      >
        <button
          onClick={onAnnotate}
          style={{
            padding: '6px 14px',
            border: 'none',
            borderRadius: 4,
            background: 'var(--chrome-blue)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Annotate
        </button>
        <button
          onClick={() => void onClose()}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--chrome-border)',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--chrome-text-primary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Close
        </button>
      </div>

      {/* Content: image + optional details panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Image area */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#1a1a2e',
            padding: 8,
          }}
        >
          <img
            src={dataUrl}
            alt="Screenshot preview"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Capture details panel (capture screenshots only) */}
        {showPanel && (
          <CaptureDetailsPanel
            screenshotId={screenshotId}
            metadata={metadata!}
            initialOverrides={metadataOverrides}
            settings={captureDetailsSettings!}
            allowEdit={allowEdit}
          />
        )}
      </div>
    </div>
  );
}
