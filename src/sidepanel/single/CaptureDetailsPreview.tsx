import { useEffect, useState } from 'react';
import type { AppSettings, ScreenshotItem } from '../../types';
import { getAppSettings } from '../../lib/storage';
import { buildCaptureDetailLines } from '../../lib/capture-adf';
import Tooltip from '../components/Tooltip';

export default function CaptureDetailsPreview({ screenshots }: { screenshots: ScreenshotItem[] }) {
  const [open, setOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const captureCount = screenshots.filter((s) => s.metadata !== null).length;

  useEffect(() => {
    getAppSettings().then(setAppSettings);
  }, []);

  if (captureCount === 0 || !appSettings) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--chrome-text-secondary)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>
          ▼
        </span>
        Capture details — {captureCount} screenshot{captureCount === 1 ? '' : 's'}
        <Tooltip text="These details are not part of the text above. They are generated from the screenshots and merged into the description when the task is created." />
      </button>
      {open && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--chrome-text-secondary)', lineHeight: 1.4 }}>
          {screenshots
            .filter((s): s is ScreenshotItem & { metadata: NonNullable<ScreenshotItem['metadata']> } => s.metadata !== null)
            .map((s) => {
              const lines = buildCaptureDetailLines(s, appSettings.captureDetails);
              return (
                <div key={s.id}>
                  <div style={{ fontWeight: 500, color: 'var(--chrome-text-primary)' }}>{s.filename}</div>
                  {lines.map((line) => <div key={line}>{line}</div>)}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
