import { useEffect, useState } from 'react';
import { useEditorTransfer } from './useEditorTransfer';
import { useWindowBounds } from './useWindowBounds';
import AnnotateMode from './AnnotateMode';
import type { PendingEditor } from '../types';

export default function AnnotationEditor() {
  const [pending, setPending] = useState<PendingEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const { readPendingEditor, cleanup } = useEditorTransfer();
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

  async function handleClose() {
    await cleanup();
    const win = await chrome.windows.getCurrent();
    if (win.id) chrome.windows.remove(win.id);
  }

  return (
    <AnnotateMode
      pending={pending}
      onClose={handleClose}
    />
  );
}
