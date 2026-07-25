import { useState } from 'react';
import Tooltip from './Tooltip';

interface AccordionProps {
  title: string;
  tooltip?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function Accordion({ title, tooltip, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '1px solid var(--chrome-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--chrome-text-primary)',
          }}
        >
          {title}
          {tooltip && <Tooltip text={tooltip} />}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: 'var(--chrome-text-secondary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div style={{ padding: '8px 0' }}>{children}</div>}
    </div>
  );
}
