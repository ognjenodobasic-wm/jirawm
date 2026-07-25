import { useEffect, useState } from 'react';
import { useEditorTransfer } from './useEditorTransfer';
import { useWindowBounds } from './useWindowBounds';
import AnnotateMode from './AnnotateMode';
import type { PendingEditor } from '../types';

export default function AnnotationEditor() {
  const [pending, setPending] = useState<PendingEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const { readPendingEditor, writeAnnotationResult, cleanup } = useEditorTransfer();
  useWindowBounds();

  useEffect(() => {
    readPendingEditor().then((data) => {
      setPending(data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1a1a2e',
          color: '#fff',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!pending) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1a1a2e',
          color: '#fff',
          fontSize: 14,
        }}
      >
        No editor data found.
      </div>
    );
  }

  async function handleDone(resultDataUrl: string) {
    if (!pending) return;
    await writeAnnotationResult({ dataUrl: resultDataUrl, screenshotId: pending.screenshotId });
    chrome.runtime.sendMessage({ type: 'ANNOTATION_DONE' });
    const win = await chrome.windows.getCurrent();
    if (win.id) chrome.windows.remove(win.id);
  }

  async function handleCancel() {
    await cleanup();
    const win = await chrome.windows.getCurrent();
    if (win.id) chrome.windows.remove(win.id);
  }

  return (
    <AnnotateMode
      dataUrl={pending.dataUrl}
      onDone={handleDone}
      onCancel={handleCancel}
    />
  );
}
