import { useEffect, useState } from 'react';
import { getLocal } from '../lib/storage';
import BulkUploadSection from './help/sections/BulkUploadSection';
import ChangelogSection from './help/sections/ChangelogSection';
import CommentSection from './help/sections/CommentSection';
import EditorSection from './help/sections/EditorSection';
import FeedbackSection from './help/sections/FeedbackSection';
import IntroSection from './help/sections/IntroSection';
import QuickSetupSection from './help/sections/QuickSetupSection';
import ScreenshotSection from './help/sections/ScreenshotSection';
import SingleTaskSection from './help/sections/SingleTaskSection';
import WorkflowsSection from './help/sections/WorkflowsSection';

type HelpSection =
  | 'intro'
  | 'quicksetup'
  | 'single'
  | 'bulk'
  | 'comment'
  | 'screenshot'
  | 'editor'
  | 'workflows'
  | 'feedback'
  | 'changelog';

const SECTIONS: { id: HelpSection; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'quicksetup', label: 'Quick setup' },
  { id: 'single', label: 'Task' },
  { id: 'bulk', label: 'Bulk upload' },
  { id: 'comment', label: 'Comment' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'editor', label: 'Editor' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'changelog', label: 'Changelog' },
];

/* ── Scrollbar styles (injected once) ── */
const SCROLLBAR_CSS = `
  .help-content::-webkit-scrollbar { width: 6px; }
  .help-content::-webkit-scrollbar-thumb { background: var(--chrome-border); border-radius: 3px; }
  .help-content::-webkit-scrollbar-track { background: transparent; }
`;

function HelpContent({ section }: { section: HelpSection }) {
  switch (section) {
    case 'intro':
      return <IntroSection />;
    case 'quicksetup':
      return <QuickSetupSection />;
    case 'single':
      return <SingleTaskSection />;
    case 'bulk':
      return <BulkUploadSection />;
    case 'comment':
      return <CommentSection />;
    case 'screenshot':
      return <ScreenshotSection />;
    case 'editor':
      return <EditorSection />;
    case 'workflows':
      return <WorkflowsSection />;
    case 'feedback':
      return <FeedbackSection />;
    case 'changelog':
      return <ChangelogSection />;
    default:
      return <IntroSection />;
  }
}

interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  checkedAt: string;
}

function UpdateIndicator() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | undefined>();

  useEffect(() => {
    getLocal<UpdateInfo>('updateInfo').then((value) => setUpdateInfo(value ?? undefined));

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      if ('updateInfo' in changes) {
        setUpdateInfo((changes.updateInfo.newValue as UpdateInfo | undefined) ?? undefined);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!updateInfo) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        textAlign: 'center',
        padding: '8px 12px',
        fontSize: '12px',
        background: '#fff3cd',
        borderTop: '1px solid #e6c200',
        color: 'var(--chrome-text-primary)',
      }}
    >
      New version {updateInfo.latestVersion} is available.{' '}
      <a
        href={updateInfo.downloadUrl}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--chrome-blue)', textDecoration: 'underline' }}
      >
        Download
      </a>
    </div>
  );
}

export default function Help() {
  const [activeSection, setActiveSection] = useState<HelpSection>('intro');

  return (
    <div className="flex flex-col h-full">
      <style>{SCROLLBAR_CSS}</style>

      <div className="flex" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

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
                borderLeft: isActive
                  ? '2px solid var(--chrome-blue)'
                  : '2px solid transparent',
                background: isActive ? '#e8f0fe' : 'transparent',
                color: isActive
                  ? 'var(--chrome-blue)'
                  : 'var(--chrome-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#e8eaed';
                  e.currentTarget.style.color = 'var(--chrome-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--chrome-text-secondary)';
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Scrollable content area */}
      <div
        className="flex-1 overflow-y-auto help-content"
        style={{
          padding: '20px 16px',
          background: 'var(--chrome-bg)',
        }}
      >
        <HelpContent section={activeSection} />
      </div>
      </div>

      <UpdateIndicator />
    </div>
  );
}
