import { useState } from 'react';

type HelpSection = 'intro' | 'quicksetup' | 'single' | 'bulk' | 'screenshot' | 'feedback';

const SECTIONS: { id: HelpSection; label: string; title: string }[] = [
  { id: 'intro', label: 'Intro', title: 'Intro' },
  { id: 'quicksetup', label: 'Quick setup', title: 'Quick setup' },
  { id: 'single', label: 'Single task', title: 'Single task' },
  { id: 'bulk', label: 'Bulk upload', title: 'Bulk upload' },
  { id: 'screenshot', label: 'Screenshot', title: 'Screenshot' },
  { id: 'feedback', label: 'Feedback', title: 'Feedback' },
];

function HelpContent({ section }: { section: HelpSection }) {
  const item = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  return (
    <div>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          margin: '0 0 12px 0',
          color: 'var(--chrome-text-primary)',
        }}
      >
        {item.title}
      </h2>
      <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--chrome-text-secondary)', margin: 0 }}>
        Placeholder — sadržaj dolazi.
      </p>
    </div>
  );
}

export default function Help() {
  const [activeSection, setActiveSection] = useState<HelpSection>('intro');

  return (
    <div className="flex h-full">
      {/* Left sidebar navigation */}
      <nav
        className="shrink-0"
        style={{
          width: '128px',
          background: 'var(--chrome-surface)',
          borderRight: '1px solid var(--chrome-border)',
        }}
      >
        {SECTIONS.map(({ id, label }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                border: 'none',
                borderLeft: isActive ? '3px solid var(--chrome-blue)' : '3px solid transparent',
                background: 'none',
                color: isActive ? 'var(--chrome-blue)' : 'var(--chrome-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Scrollable content area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: '20px 16px',
          background: 'var(--chrome-bg)',
        }}
      >
        <HelpContent section={activeSection} />
      </div>
    </div>
  );
}
