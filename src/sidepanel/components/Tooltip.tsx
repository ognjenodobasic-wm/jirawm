import { useEffect, useId, useRef, useState } from 'react';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleId = useId();

  useEffect(() => {
    if (!visible || !triggerRef.current || !bubbleRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    const panelRect = triggerRef.current.closest('[data-sidepanel-root]')?.getBoundingClientRect() ??
      document.documentElement.getBoundingClientRect();

    const minGap = 4;
    const spaceAbove = triggerRect.top - panelRect.top;
    const fitsAbove = spaceAbove >= bubbleRect.height + minGap;

    const nextPosition: 'top' | 'bottom' = fitsAbove ? 'top' : 'bottom';
    setPosition(nextPosition);

    let left = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
    left = Math.max(panelRect.left + minGap, Math.min(left, panelRect.right - bubbleRect.width - minGap));
    left -= panelRect.left;

    const nextStyle: React.CSSProperties = {
      left,
      maxWidth: 240,
    };

    if (nextPosition === 'top') {
      nextStyle.bottom = panelRect.bottom - triggerRect.top + 6;
    } else {
      nextStyle.top = triggerRect.bottom - panelRect.top + 6;
    }

    setStyle(nextStyle);
  }, [visible]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setVisible(false);
    }
    if (visible) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [visible]);

  function show() {
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={bubbleId}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1px solid var(--chrome-border)',
          background: 'transparent',
          color: 'var(--chrome-text-secondary)',
          fontSize: 10,
          lineHeight: 1,
          padding: 0,
          cursor: 'help',
          flexShrink: 0,
        }}
      >
        {children ?? '?'}
      </button>
      {visible && (
        <div
          ref={bubbleRef}
          id={bubbleId}
          role="tooltip"
          style={{
            position: 'fixed',
            zIndex: 9999,
            background: 'var(--chrome-text-primary)',
            color: '#fff',
            fontSize: 11,
            lineHeight: 1.4,
            padding: '6px 8px',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
            whiteSpace: 'normal',
            ...style,
          }}
        >
          {text}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              ...(position === 'top'
                ? { top: '100%', borderTop: '4px solid var(--chrome-text-primary)' }
                : { bottom: '100%', borderBottom: '4px solid var(--chrome-text-primary)' }),
            }}
          />
        </div>
      )}
    </>
  );
}
