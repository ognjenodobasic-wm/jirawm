import { useState } from 'react';

type HelpSection = 'intro' | 'quicksetup' | 'single' | 'bulk' | 'screenshot' | 'feedback';

const SECTIONS: { id: HelpSection; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'quicksetup', label: 'Quick setup' },
  { id: 'single', label: 'Single task' },
  { id: 'bulk', label: 'Bulk upload' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'feedback', label: 'Feedback' },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: '#fce8b2',
        color: '#b06000',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--chrome-surface)',
        border: '1px solid var(--chrome-border)',
        borderRadius: '8px',
        padding: '14px',
        marginTop: '12px',
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '18px',
        fontWeight: 600,
        margin: '0 0 6px 0',
        color: 'var(--chrome-text-primary)',
      }}
    >
      {children}
    </h2>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '13px',
        lineHeight: 1.5,
        color: 'var(--chrome-text-secondary)',
        margin: '0 0 18px 0',
      }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--chrome-border)',
        margin: '20px 0',
      }}
    />
  );
}

function Text({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'var(--chrome-text-primary)',
        margin: '0 0 12px 0',
      }}
    >
      {children}
    </p>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul
      style={{
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'var(--chrome-text-primary)',
        paddingLeft: '18px',
        margin: '0 0 12px 0',
      }}
    >
      {items.map((item, idx) => (
        <li key={idx} style={{ marginBottom: '6px' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function IntroSection() {
  return (
    <div>
      <SectionTitle>What is JiraWM?</SectionTitle>
      <Subtitle>
        A browser extension that cuts the friction out of logging UI bugs and tasks to Jira.
      </Subtitle>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Why it exists
        </h3>
        <Text>
          Logging a task the normal way means: screenshot tool, upload, switch to Jira, pick
          project, pick epic, fill the same fields again. For a team logging 10–30 tasks a day,
          that's real time lost. JiraWM collapses this to: capture, type a title, submit.
        </Text>
      </Card>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          What you can do
        </h3>
        <List
          items={[
            <>
              <strong>Single task:</strong> Capture the current tab, add a title, attach to the
              right Jira task in one click.
            </>,
            <>
              <strong>Bulk upload:</strong> Drop multiple screenshots at once — each becomes a
              separate Jira task, processed in the background while you keep working.
            </>,
            <>
              <strong>Annotations</strong> <Badge>coming soon</Badge>: Mark up screenshots with
              arrows, rectangles, and labels before attaching them.
            </>,
          ]}
        />
      </Card>

      <Divider />

      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          margin: '0 0 8px 0',
          color: 'var(--chrome-text-primary)',
        }}
      >
        What's a workflow?
      </h3>
      <Text>
        A workflow is a saved preset: which Jira project, which issue type, which parent task, and
        all the required field defaults. You set it up once — then every task you create with it
        fills those fields automatically.
      </Text>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Workflow options
        </h3>
        <List
          items={[
            <>
              <strong>Project + issue type:</strong> Picked from your actual Jira projects — no
              manual key typing.
            </>,
            <>
              <strong>Parent task:</strong> Optionally pin all tasks to a parent. All tasks created
              with this workflow become subtasks of it.
            </>,
            <>
              <strong>Required fields:</strong> Set defaults once — Sprint, Priority, Component, or
              any field your project requires.
            </>,
            <>
              <strong>Optional fields:</strong> Include only the fields you actually use. Leave the
              rest out.
            </>,
          ]}
        />
      </Card>

      <Text>
        💡 <strong>Tip:</strong> think of one workflow per context — "QA bugs", "UX feedback",
        "PM tasks". Don't try to make one workflow do everything.
      </Text>
    </div>
  );
}

function QuickSetupSection() {
  return (
    <div>
      <SectionTitle>Quick setup</SectionTitle>
      <Subtitle>Three things to do before your first task.</Subtitle>

      <Step
        number={1}
        title="Get a Jira API token"
        text="Go to id.atlassian.com → Security → API tokens, create a new token, and copy it. Treat it like a password — don't share it."
      >
        <a
          href="https://id.atlassian.com/manage-profile/security/api-tokens"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--chrome-blue)',
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          https://id.atlassian.com/manage-profile/security/api-tokens
        </a>
      </Step>

      <Step
        number={2}
        title="Connect to Jira"
        text="Open Settings (⚙ top right). Enter your Jira subdomain, email address, and the API token. Hit “Test connection” — you should see your display name confirmed."
      >
        <div
          style={{
            background: 'var(--chrome-surface)',
            border: '1px solid var(--chrome-border)',
            borderRadius: '6px',
            padding: '10px 12px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--chrome-text-primary)',
            marginTop: '8px',
          }}
        >
          yourcompany.atlassian.net
        </div>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--chrome-text-secondary)',
            margin: '6px 0 0 0',
          }}
        >
          Enter only the subdomain, not the full URL.
        </p>
      </Step>

      <Step
        number={3}
        title="Create your first workflow"
        text="From the Single Task or Bulk Upload tab, click “+ New workflow”. Follow the 5-step guide: pick project → issue type → optional parent task → set required field defaults → name it and save."
      />

      <Divider />

      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          margin: '0 0 8px 0',
          color: 'var(--chrome-text-primary)',
        }}
      >
        Screenshot quality
      </h3>
      <Text>
        By default, screenshots are compressed to JPEG at 85% quality with a max width of 1920px.
        This keeps file sizes small while staying visually sharp for UI work.
      </Text>

      <Card>
        <List
          items={[
            <>
              <strong>Global defaults:</strong> Set your preferred quality and max width in
              Settings. Applies to all workflows unless overridden.
            </>,
            <>
              <strong>Per-workflow override</strong> <Badge>coming soon</Badge>: Override
              compression settings for a specific workflow — useful if one project needs higher
              fidelity.
            </>,
          ]}
        />
      </Card>
    </div>
  );
}

function Step({
  number,
  title,
  text,
  children,
}: {
  number: number;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'var(--chrome-blue)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 4px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          {title}
        </h3>
        <Text>{text}</Text>
        {children}
      </div>
    </div>
  );
}

function SingleTaskSection() {
  return (
    <div>
      <SectionTitle>Single task</SectionTitle>
      <Subtitle>Create one Jira task from the current browser tab.</Subtitle>

      <List
        items={[
          <>
            <span style={{ marginRight: '6px' }}>1️⃣</span>
            <strong>Select a workflow</strong> — Pick the right workflow from the dropdown at the
            top of the panel. This determines the project, issue type, parent, and all field
            defaults.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>📷</span>
            <strong>Capture a screenshot</strong> — Click "Capture" to screenshot the current tab. A
            thumbnail preview appears in the panel — click it to see the full image.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>✏️</span>
            <strong>Add a summary</strong> — Write a short task title. A description is optional.
            Everything else comes from your workflow — you don't see or touch it.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>🚀</span>
            <strong>Create task</strong> — Hit "Create task". The extension creates the issue,
            attaches the screenshot, and shows you the task key as a clickable link (e.g. AT-234).
          </>,
        ]}
      />

      <Divider />

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Multiple screenshots per task <Badge>coming soon</Badge>
        </h3>
        <Text>
          A thumbnail strip will let you capture several screenshots and attach all of them to a
          single task, with drag-to-reorder support.
        </Text>
      </Card>
    </div>
  );
}

function BulkUploadSection() {
  return (
    <div>
      <SectionTitle>Bulk upload</SectionTitle>
      <Subtitle>Turn a folder of screenshots into Jira tasks without sitting and waiting.</Subtitle>

      <List
        items={[
          <>
            <span style={{ marginRight: '6px' }}>📂</span>
            <strong>Drop your screenshots</strong> — Drag image files onto the drop zone, or click
            "Select files" to pick them. Each file becomes one row in the table — one task.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>📝</span>
            <strong>Add summaries</strong> — Each row has a summary field. That's the only thing
            you fill in per task — everything else comes from the workflow selected at the top.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>▶️</span>
            <strong>Start upload</strong> — Click "Start upload". Tasks are created one at a time in
            the background — you can close the panel and keep working while it runs.
          </>,
        ]}
      />

      <Divider />

      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          margin: '0 0 8px 0',
          color: 'var(--chrome-text-primary)',
        }}
      >
        Status meanings
      </h3>
      <List
        items={[
          <>
            <span style={{ marginRight: '6px' }}>⏸️</span>Waiting to start
          </>,
          <>
            <span style={{ marginRight: '6px' }}>⏳</span>Creating issue in Jira
          </>,
          <>
            <span style={{ marginRight: '6px' }}>⏳</span>Uploading screenshot
          </>,
          <>
            <span style={{ marginRight: '6px' }}>✅</span>Done — task key shown as a link
          </>,
          <>
            <span style={{ marginRight: '6px' }}>❌</span>Failed — retry button appears
          </>,
        ]}
      />

      <Divider />

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Retry failed tasks
        </h3>
        <Text>
          If some tasks fail, use "Retry failed" to reprocess only those rows — not the ones that
          already succeeded. Progress is saved even if you close the panel.
        </Text>
      </Card>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Completion notification
        </h3>
        <Text>
          When all tasks finish, a desktop notification tells you how many succeeded. Clicking it
          reopens the panel with the full results and all task links.
        </Text>
      </Card>
    </div>
  );
}

function ScreenshotSection() {
  return (
    <div>
      <SectionTitle>Screenshot</SectionTitle>
      <Subtitle>How capture and compression work in JiraWM.</Subtitle>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          <span style={{ marginRight: '6px' }}>📷</span>Capturing
        </h3>
        <Text>
          JiraWM captures the visible area of the current tab using the browser's built-in
          screenshot API. The capture happens instantly — no external tool, no clipboard, no
          switching apps.
        </Text>
      </Card>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          <span style={{ marginRight: '6px' }}>🗜️</span>Compression
        </h3>
        <Text>
          Screenshots are automatically converted to JPEG and resized if needed. Default: Quality
          85%, Max width 1920px — roughly 10× smaller than PNG, sharp enough for UI work.
        </Text>
      </Card>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          <span style={{ marginRight: '6px' }}>🖼️</span>Preview
        </h3>
        <Text>
          After capture, a thumbnail appears in the Single Task form. Click the thumbnail to see the
          full-size image in a lightbox overlay — without leaving the panel or opening a new tab.
        </Text>
      </Card>

      <Divider />

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Annotations <Badge>coming soon</Badge>
        </h3>
        <Text>
          A dedicated editor will open with your screenshot and let you add arrows, rectangles, text
          labels, and free drawing — with full undo/redo. The annotated image is what gets attached
          to Jira — the original is never modified.
        </Text>
      </Card>
    </div>
  );
}

function FeedbackSection() {
  return (
    <div>
      <SectionTitle>Feedback</SectionTitle>
      <Subtitle>Bug reports, feature requests, and ideas — all welcome.</Subtitle>

      <div
        style={{
          background: '#e8f0fe',
          border: '1px solid #c5d9f8',
          borderRadius: '8px',
          padding: '14px',
          marginTop: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Found a bug or have a request?
        </h3>
        <Text>
          Open an issue on GitHub. Be specific — what you expected, what happened, and which browser
          version you're on. The more detail, the faster it gets fixed.
        </Text>
        <a
          href="https://github.com/ognjenodobasic-wm/jirawm/issues"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            background: 'var(--chrome-blue)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            padding: '8px 14px',
            borderRadius: '6px',
            textDecoration: 'none',
            marginTop: '4px',
          }}
        >
          Open an issue on GitHub
        </a>
      </div>

      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          What makes a good report
        </h3>
        <List
          items={[
            <>
              <strong>Steps to reproduce:</strong> What did you do, in what order?
            </>,
            <>
              <strong>Expected vs. actual:</strong> What should have happened? What did instead?
            </>,
            <>
              <strong>Context:</strong> Chrome version, Jira Cloud setup, workflow config if
              relevant.
            </>,
          ]}
        />
      </Card>

      <Divider />

      <div
        style={{
          border: '1px dashed var(--chrome-border)',
          borderRadius: '8px',
          padding: '14px',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-text-primary)',
          }}
        >
          Want to contribute?
        </h3>
        <Text>
          JiraWM is built for internal use but the codebase is open. If you work with Chrome
          extensions, React, or Jira integrations and want to help shape where this goes — reach out
          via GitHub or open a PR.
        </Text>
        <a
          href="https://github.com/ognjenodobasic-wm/jirawm"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--chrome-blue)',
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          https://github.com/ognjenodobasic-wm/jirawm
        </a>
      </div>
    </div>
  );
}

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
    case 'screenshot':
      return <ScreenshotSection />;
    case 'feedback':
      return <FeedbackSection />;
    default:
      return <IntroSection />;
  }
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
                borderLeft: isActive
                  ? '3px solid var(--chrome-blue)'
                  : '3px solid transparent',
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
