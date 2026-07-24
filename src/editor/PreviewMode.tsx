import { useEffect } from 'react';

interface PreviewModeProps {
  dataUrl: string;
  thumbnailIndex: number;
}

export default function PreviewMode({ dataUrl, thumbnailIndex }: PreviewModeProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeWindow();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function closeWindow() {
    chrome.windows.getCurrent((win) => {
      if (win.id != null) chrome.windows.remove(win.id);
    });
  }

  function handleAnnotate() {
    const params = new URLSearchParams(window.location.search);
    const index = params.get('index') ?? String(thumbnailIndex);

    chrome.windows.getCurrent((currentWin) => {
      chrome.windows.create(
        {
          type: 'popup',
          url: chrome.runtime.getURL('editor.html') + '?mode=annotate&index=' + index,
          width: currentWin.width ?? 1000,
          height: currentWin.height ?? 700,
          left: currentWin.left,
          top: currentWin.top,
        },
        () => {
          if (currentWin.id != null) chrome.windows.remove(currentWin.id);
        },
      );
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '8px 12px',
          flexShrink: 0,
        }}
      >
        <button onClick={handleAnnotate} style={buttonStyle('#4499ff')}>
          ✎ Annotate
        </button>
        <button onClick={closeWindow} style={buttonStyle('#555')}>
          ✕ Close
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 8,
        }}
      >
        <img
          src={dataUrl}
          alt="Screenshot preview"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>
  );
}

function buttonStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
  };
}
