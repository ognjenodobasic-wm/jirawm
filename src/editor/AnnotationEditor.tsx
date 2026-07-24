import { useEffect, useState } from 'react';
import { useEditorTransfer } from './useEditorTransfer';
import { useWindowBounds } from './useWindowBounds';
import PreviewMode from './PreviewMode';
import AnnotateMode from './AnnotateMode';
import type { EditorMode, PendingEditor } from '../types';

export default function AnnotationEditor() {
  const [mode, setMode] = useState<EditorMode | null>(null);
  const [pending, setPending] = useState<PendingEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const { readPendingEditor } = useEditorTransfer();
  useWindowBounds();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') as EditorMode | null;
    setMode(urlMode);

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

  if (mode === 'preview') {
    return <PreviewMode dataUrl={pending.dataUrl} thumbnailIndex={pending.thumbnailIndex} />;
  }

  if (mode === 'annotate') {
    return <AnnotateMode dataUrl={pending.dataUrl} thumbnailIndex={pending.thumbnailIndex} />;
  }

  return null;
}
