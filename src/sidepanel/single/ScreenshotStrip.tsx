import { useEffect, useRef, useState } from 'react';
import type { ScreenshotItem } from '../../types';
import { hasMetadataOverrides } from '../../lib/capture-adf';
import Tooltip from '../components/Tooltip';
import { MAX_SCREENSHOTS } from './types';

interface ScreenshotStripProps {
  screenshots: ScreenshotItem[];
  selectedId: string | null;
  isLoading: boolean;
  capturePermission: boolean | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onCapture: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenEditor: (index: number) => void;
  onRemove: (id: string) => void;
  onOpenSettings: () => void;
}

export default function ScreenshotStrip({
  screenshots,
  selectedId,
  isLoading,
  capturePermission,
  fileInputRef,
  onCapture,
  onFileSelect,
  onOpenEditor,
  onRemove,
  onOpenSettings,
}: ScreenshotStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function updateFade() {
      if (!el) return;
      setShowFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }
    updateFade();
    el.addEventListener('scroll', updateFade);
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro.disconnect();
    };
  }, [screenshots.length]);

  return (
    <div
      style={{
        border: '1px solid var(--chrome-border)',
        borderRadius: 8,
        background: 'var(--chrome-bg)',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--chrome-border)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--chrome-text-primary)' }}>
            Screenshots
          </span>
          <span
            style={{
              fontSize: 11,
              color: screenshots.length >= MAX_SCREENSHOTS ? 'var(--chrome-red)' : 'var(--chrome-text-secondary)',
            }}
          >
            ({screenshots.length}/{MAX_SCREENSHOTS})
          </span>
          <Tooltip text="Up to 10 per task. Screenshots you capture here also record the page URL, viewport and browser. Files you add from disk do not." />
        </div>
        <div className="flex items-center gap-2">
          {capturePermission === false ? (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--chrome-text-secondary)' }}>
              Screenshot dozvola nije odobrena.
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs"
                style={{
                  color: 'var(--chrome-blue)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Podesi u opcijama ekstenzije
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onCapture}
              disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--chrome-blue)',
                color: '#fff',
                cursor: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 'not-allowed' : 'pointer',
                opacity: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 0.5 : 1,
              }}
            >
              Capture
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || screenshots.length >= MAX_SCREENSHOTS}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--chrome-border)',
              background: 'transparent',
              color: 'var(--chrome-text-primary)',
              cursor: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 'not-allowed' : 'pointer',
              opacity: isLoading || screenshots.length >= MAX_SCREENSHOTS ? 0.5 : 1,
            }}
          >
            Add
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={onFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            gap: 8,
            padding: 8,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--chrome-border) transparent',
          }}
        >
          {screenshots.length === 0 && (
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--chrome-text-secondary)',
                padding: '12px 0',
              }}
            >
              No screenshots yet — capture the page or add a file.
            </div>
          )}
          {screenshots.map((item, index) => (
            <div
              key={item.id}
              style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
            >
              <div
                onClick={() => onOpenEditor(index)}
                style={{
                  position: 'relative',
                  width: 64,
                  height: 64,
                  borderRadius: 4,
                  border: `2px solid ${selectedId === item.id ? 'var(--chrome-blue)' : 'transparent'}`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={item.dataUrl}
                  alt="Screenshot thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, pointerEvents: 'none' }}
                />
                {item.annotated && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: 10,
                      padding: '2px 5px',
                      borderRadius: 3,
                      pointerEvents: 'none',
                    }}
                  >
                    ✎
                  </div>
                )}
                {item.origin === 'capture' && hasMetadataOverrides(item) && (
                  <div
                    title="Capture details edited"
                    style={{
                      position: 'absolute',
                      top: 18,
                      right: 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'var(--chrome-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M5 0.5L7.5 3L2.5 8H0V5.5L5 0.5Z" fill="white" />
                    </svg>
                  </div>
                )}
                {item.number !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: 10,
                      padding: '2px 5px',
                      borderRadius: 3,
                      pointerEvents: 'none',
                    }}
                  >
                    {item.number}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                  aria-label="Remove screenshot"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 16,
                    height: 16,
                    background: 'var(--chrome-red)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    fontSize: 10,
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        {showFade && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 24,
              background: 'linear-gradient(to right, transparent, var(--chrome-bg))',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
