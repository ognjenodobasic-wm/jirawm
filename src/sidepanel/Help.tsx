import { useState } from 'react';

type HelpSection =
  | 'intro'
  | 'quicksetup'
  | 'single'
  | 'bulk'
  | 'screenshot'
  | 'editor'
  | 'workflows'
  | 'feedback'
  | 'changelog';

const SECTIONS: { id: HelpSection; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'quicksetup', label: 'Quick setup' },
  { id: 'single', label: 'Single task' },
  { id: 'bulk', label: 'Bulk upload' },
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--chrome-surface)',
        border: '1px solid var(--chrome-border)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '10px',
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

function SmallText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '12px',
        lineHeight: 1.6,
        color: 'var(--chrome-text-secondary)',
        margin: '0 0 12px 0',
      }}
    >
      {children}
    </p>
  );
}

/** Action row list with bottom borders (used in Single/Bulk sections) */
function ActionList({ items }: { items: React.ReactNode[] }) {
  return (
    <div style={{ margin: '0 0 12px 0' }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--chrome-text-primary)',
            padding: '10px 0',
            borderBottom:
              idx < items.length - 1 ? '1px solid var(--chrome-border)' : 'none',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#f8f9fa',
        border: '1px solid var(--chrome-border)',
        borderRadius: '4px',
        padding: '8px 10px',
        fontFamily: "'Courier New', monospace",
        fontSize: '11px',
        color: 'var(--chrome-text-primary)',
        marginTop: '8px',
      }}
    >
      {children}
    </div>
  );
}

const cardHeadingStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--chrome-text-primary)',
};

function IntroSection() {
  return (
    <div>
      <SectionTitle>What is JiraWM?</SectionTitle>
      <Subtitle>
        A browser extension that cuts the friction out of logging UI bugs and tasks to Jira.
      </Subtitle>

      <Text>
        The tab bar shows <strong>Single Task</strong>, <strong>Bulk Upload</strong> and{' '}
        <strong>Workflows</strong> on the left, with <strong>Help</strong> and the{' '}
        <strong>⚙️</strong> settings button on the right. Below the tabs, a sticky row shows the
        selected workflow with “+ New” and “Edit” links — it only appears on the Single Task and Bulk
        Upload tabs.
      </Text>

      <Card>
        <h3 style={cardHeadingStyle}>The four tabs</h3>
        <ActionList
          items={[
            <>
              <strong>Single Task:</strong> Capture the current tab or upload files, add a summary,
              and create one Jira task.
            </>,
            <>
              <strong>Bulk Upload:</strong> Drop a folder of screenshots and turn each one into a
              separate Jira task in the background.
            </>,
            <>
              <strong>Workflows:</strong> Create, edit, import and export saved task templates.
            </>,
            <>
              <strong>Help:</strong> Browse this guide and the changelog.
            </>,
          ]}
        />
      </Card>
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
        text="Open Settings (⚙️ top right). Enter your Jira subdomain, email address, and the API token. Hit “Test connection” — you should see your display name confirmed."
      >
        <CodeBlock>yourcompany.atlassian.net</CodeBlock>
        <SmallText>Enter only the subdomain, not the full URL.</SmallText>
      </Step>

      <Step
        number={3}
        title="Create your first workflow"
        text="From the Single Task or Bulk Upload tab, click “+ New workflow”. Follow the 5-step guide: pick project → issue type → optional parent task → set required field defaults → name it and save."
      />

      <Divider />

      <h3 style={cardHeadingStyle}>Page access</h3>
      <Text>
        The first time you take a screenshot, Chrome asks for permission to read the current page.
        Uploading files works without it.
      </Text>

      <Divider />

      <h3 style={cardHeadingStyle}>Settings overview</h3>
      <Text>
        Settings (⚙️ top right) is split into three collapsible sections. Changes save automatically
        — there is no Save button except for the Jira connection at the top.
      </Text>

      <Card>
        <h3 style={cardHeadingStyle}>Image handling</h3>
        <Text>
          Controls how images are converted on entry. Every image is normalised to JPEG immediately —
          the quality slider and max width apply at that point only. Annotations and crops are always
          saved at maximum quality regardless of the quality setting, so editing never degrades an
          image twice. The transparency fill option sets the background colour for PNGs with
          transparent areas: white suits most UI screenshots, black suits dark-mode UIs.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Screenshot naming</h3>
        <Text>
          Attaches a number to each screenshot so you can reference them from the description. Single
          task names them 1.jpg, 2.jpg in the order they appear in the strip. Bulk upload prefixes the
          filename (e.g. 1 - login-error.jpg). Numbers are never reused — deleting screenshot 2 does
          not renumber screenshot 3.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Capture details</h3>
        <Text>
          Automatically appends a metadata block to the task description when a screenshot is taken
          with the extension. The block includes page URL, page title, timestamp, viewport size, zoom
          level, and browser/OS. It is generated at the moment the task is created, so it always
          matches what is attached. Uploaded files never get this block. The block can be placed at
          the start or end of the description; individual fields can be turned off; and the whole
          feature can be disabled. Configurable per field in Settings.
        </Text>
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
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--chrome-blue)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={cardHeadingStyle}>{title}</h3>
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

      <ActionList
        items={[
          <>
            <span style={{ marginRight: '6px' }}>1️⃣</span>
            <strong>Select a workflow</strong> — Pick the right workflow from the dropdown at the
            top of the panel. This determines the project, issue type, parent, and all field
            defaults.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>📷</span>
            <strong>Capture or add screenshots</strong> — Click <strong>Capture</strong> to take a
            screenshot of the current browser tab, or <strong>Add</strong> to open a file picker and
            upload existing images. Both add thumbnails to the scrollable strip. Each thumbnail has a
            centered <strong>Edit</strong> button that opens the editor popup.
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
        <h3 style={cardHeadingStyle}>Capture details</h3>
        <Text>
          Screenshots taken with the extension add a short block to the description with the page
          URL, viewport size, zoom level and browser version — useful for bug reports where those
          conditions matter. It isn't typed into the description box; it's generated when the task
          is created, so it always matches what's attached. Uploaded files don't get this block.
          Turn it off in Settings if you don't need it.
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

      <ActionList
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

      <h3 style={cardHeadingStyle}>Task status</h3>

      <div style={{ margin: '0 0 18px 0' }}>
        {[
          { icon: '⏸️', text: 'Waiting to start' },
          { icon: '⏳', text: 'Creating issue in Jira' },
          { icon: '⏳', text: 'Uploading screenshot' },
          { icon: '✅', text: 'Done — task key shown as a link' },
          { icon: '❌', text: 'Failed — retry button appears' },
        ].map((row, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--chrome-text-primary)',
              padding: '6px 0',
            }}
          >
            <span>{row.icon}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Retry failed tasks</h3>
        <Text>
          If some tasks fail, use "Retry failed" to reprocess only those rows — not the ones that
          already succeeded. Progress is saved even if you close the panel.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Completion notification</h3>
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
        <h3 style={cardHeadingStyle}>
          <span style={{ marginRight: '6px' }}>📷</span>Capturing
        </h3>
        <Text>
          JiraWM captures the visible area of the current tab using the browser's built-in
          screenshot API. The capture happens instantly — no external tool, no clipboard, no
          switching apps.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Image format</h3>
        <Text>
          Every image entering the extension is converted to JPEG. You do not need to prepare files
          in advance — drop in PNGs, screenshots from any tool, or exported designs. Quality and max
          width are controlled in Settings → Image handling.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Crop</h3>
        <Text>
          Click any thumbnail to open it. In the editor, activate Crop before you start drawing. Drag
          a selection, resize with the handles, then click Apply. Crop is disabled once annotations
          exist — this protects your work from being cut away. Undo after a crop restores the full
          image.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>
          <span style={{ marginRight: '6px' }}>🖼️</span>Preview
        </h3>
        <Text>
          After capture, a thumbnail appears in the Single Task form. Click the thumbnail to open
          the screenshot editor.
        </Text>
      </Card>

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Annotations</h3>
        <Text>
          The screenshot editor lets you add arrows, rectangles, text labels, and numbered markers —
          with full undo/redo and keyboard shortcuts. The annotated image is what gets attached to
          Jira. The original is never modified.
        </Text>
      </Card>
    </div>
  );
}

function ToolRow({
  name,
  description,
  shortcut,
}: {
  name: string;
  description: string;
  shortcut: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <div
        style={{
          width: '90px',
          flexShrink: 0,
          fontWeight: 600,
          color: 'var(--chrome-text-primary)',
        }}
      >
        {name}
      </div>
      <div style={{ flex: 1, color: 'var(--chrome-text-primary)' }}>
        {description}
        <br />
        <SmallText>Keyboard shortcut: {shortcut}</SmallText>
      </div>
    </div>
  );
}

function EditorSection() {
  return (
    <div>
      <SectionTitle>Editor</SectionTitle>
      <Subtitle>Annotate and crop screenshots before they are attached to a task.</Subtitle>

      <Text>
        Click any thumbnail to open it in the editor. The editor opens as a floating window that
        remembers its size and position. You can annotate first and decide whether to save, or close
        without changes — the original thumbnail is untouched until you click Done.
      </Text>

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Tools</h3>
        <ActionList
          items={[
            <ToolRow
              name="Crop"
              description="Select a region and click Apply. Disabled once annotations exist."
              shortcut="C"
            />,
            <ToolRow
              name="Select"
              description="Click to select an existing annotation and move or delete it."
              shortcut="V"
            />,
            <ToolRow name="Arrow" description="Draw an arrow pointing at something." shortcut="A" />,
            <ToolRow
              name="Rectangle"
              description="Draw an outline rectangle to highlight a region."
              shortcut="R"
            />,
            <ToolRow
              name="Fill"
              description="Draw a solid filled rectangle (useful for blocking out sensitive info)."
              shortcut="F"
            />,
            <ToolRow
              name="Marker"
              description="Place a numbered circle. Counters auto-increment: ①, ②, ③…"
              shortcut="M"
            />,
            <ToolRow
              name="Text"
              description="Click to place editable text. Double-click to edit after placing."
              shortcut="T"
            />,
          ]}
        />
      </Card>

      <Divider />

      <h3 style={cardHeadingStyle}>Colors and stroke</h3>
      <Text>
        Five color presets are available in the toolbar. Stroke width can be set to 2, 3, or 4px
        from the dropdown next to the colors.
      </Text>

      <Divider />

      <h3 style={cardHeadingStyle}>Undo, redo and delete</h3>
      <Text>
        Ctrl+Z undoes the last action, Ctrl+Y (or Ctrl+Shift+Z) redoes it. Undo works across crops
        and annotations in a single history stack. Select an object and press Delete or Backspace to
        remove it.
      </Text>

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Keyboard shortcuts</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr',
            gap: '6px 12px',
            fontSize: '13px',
            color: 'var(--chrome-text-primary)',
          }}
        >
          <span style={{ fontWeight: 600 }}>C</span>
          <span>Crop (when no annotations exist)</span>
          <span style={{ fontWeight: 600 }}>V</span>
          <span>Select</span>
          <span style={{ fontWeight: 600 }}>A</span>
          <span>Arrow</span>
          <span style={{ fontWeight: 600 }}>R</span>
          <span>Rectangle</span>
          <span style={{ fontWeight: 600 }}>F</span>
          <span>Fill</span>
          <span style={{ fontWeight: 600 }}>M</span>
          <span>Marker</span>
          <span style={{ fontWeight: 600 }}>T</span>
          <span>Text</span>
          <span style={{ fontWeight: 600 }}>Ctrl+Z</span>
          <span>Undo</span>
          <span style={{ fontWeight: 600 }}>Ctrl+Y</span>
          <span>Redo</span>
          <span style={{ fontWeight: 600 }}>Delete</span>
          <span>Remove selected annotation</span>
          <span style={{ fontWeight: 600 }}>Escape</span>
          <span>Cancel crop / prompt to discard and close</span>
        </div>
      </Card>
    </div>
  );
}

function WorkflowsSection() {
  return (
    <div>
      <SectionTitle>Workflows</SectionTitle>
      <Subtitle>Save task templates so you fill in only the summary each time.</Subtitle>

      <Text>
        A workflow captures everything that does not change between tasks: which Jira project to file
        in, the issue type, an optional parent task, required field defaults (sprint, priority,
        component, etc.), and a default assignee. When you create a task you pick a workflow and fill
        in the summary — everything else is pre-filled.
      </Text>

      <Divider />

      <h3 style={cardHeadingStyle}>Creating a workflow</h3>

      <Step
        number={1}
        title="Select project"
        text="Pick the Jira project. Only active projects are shown, sorted alphabetically."
      />

      <Step
        number={2}
        title="Choose issue type"
        text="Select the issue type for tasks created from this workflow."
      />

      <Step
        number={3}
        title="Set a parent task (optional)"
        text="Search by key or summary. Any task in the project can be a parent. Leave blank to create top-level issues."
      />

      <Step
        number={4}
        title="Required fields"
        text="Set default values for any field the project requires (sprint, priority, component, labels, etc.). These values are applied silently — you do not see them in the form."
      />

      <Step
        number={5}
        title="Name and save"
        text="Give the workflow a short name that describes the context, e.g. 'QA bugs', 'UX feedback', 'PM tasks'."
      />

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Import / export</h3>
        <Text>
          Use the import and export buttons on the Workflows tab to back up your workflows or share
          them with a colleague. Exported as workflows-jirawm.json. Importing merges with existing
          workflows — existing entries are not overwritten.
        </Text>
      </Card>

      <SmallText>
        💡 Tip: one workflow per context works better than one workflow for everything. If a project
        has both a QA sprint and a general backlog, make two workflows.
      </SmallText>
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
          borderRadius: '6px',
          padding: '12px',
          marginTop: '12px',
          marginBottom: '10px',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 8px 0',
            color: 'var(--chrome-blue)',
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
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: '4px',
            textDecoration: 'none',
            marginTop: '10px',
            border: 'none',
            cursor: 'pointer',
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
        <ActionList
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
          borderRadius: '6px',
          padding: '12px',
          textAlign: 'center',
          marginTop: '10px',
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '6px' }}>🤝</div>
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

const CHANGELOG_DATA = [
  {
    version: '3.1.0',
    date: 'Juli 2026',
    items: [
      'Capture details can now be corrected or hidden per screenshot, from a panel beside the annotation canvas',
      'The editor now shows Save when something changed and Close when nothing did',
      'Edited screenshots are marked with a badge in the side panel',
      'New Settings option controls whether per-screenshot editing is available',
    ],
  },
  {
    version: '3.0.1',
    date: 'Juli 2026',
    items: [
      'Screenshots captured losslessly; only one JPEG compression pass via ingest pipeline',
      'Timestamp option in Settings now controls the description block',
      'Multi-file Add enforces the 10 screenshot limit and reports skipped files',
      'Annotations target screenshots by stable id instead of array index',
      'Capture details preview matches the block sent to Jira',
      'Permission prompt now always fires on first Capture click',
    ],
  },
  {
    version: '3.0.0',
    date: 'Juli 2026',
    major: true,
    items: [
      'Crop tool inside the annotation editor',
      'Capture details block added to task descriptions from screenshot metadata',
      'Permission-free viewport derivation — no page access needed until first screenshot',
      'Screenshots now live in a dedicated card with horizontal scrolling',
      'Page access is now requested on first screenshot instead of at install time',
    ],
  },
  {
    version: '2.1.0',
    date: 'Juli 2026',
    items: [
      'Lista projekata prikazuje samo aktivne projekte, sortirana abecedno',
      'Pretraga parent taska prepisana — direktan lookup po key-u, wildcard JQL, svi izvori uvek upitani sa izolacijom grešaka',
      'Uklonjen client-side filter koji je odbacivao validne server rezultate',
      'Migracija sa deprecated GET /search na POST /search/jql',
      'Assignee dropdown sada učitava korisnike odmah po izboru projekta',
      'Save dugme vraćeno i uvek vidljivo u formi za workflow',
      'Polje za ime workflowa premješteno na vrh forme',
      'Issue type pozicioniran iznad default assignee',
      'Pretraživi assignee combobox zamjenjuje dugu native listu',
      'Inline "Connect to Jira" link u empty state-u vodi direktno na Settings',
    ],
  },
  {
    version: '2.0.0',
    date: 'Juli 2026',
    items: [
      'Annotation editor — popup prozor sa Fabric.js canvas editorom',
      'Alati: strelica, kvadrat (outline/fill), numbered markers, tekst',
      'Screenshot preview popup pre anotacije',
      '5 preset boja, stroke width, undo/redo, keyboard shortcuts',
      'Popup pamti dimenzije i poziciju između sesija',
    ],
    major: true,
  },
  {
    version: '1.4.0',
    date: 'Juli 2026',
    items: [
      'Assignee dropdown u Single i Bulk modu',
      'Help panel sa 6 sekcija',
    ],
  },
  {
    version: '1.3.0',
    date: 'Juli 2026',
    items: [
      'Thumbnail strip — više screenshotova po tasku (max 10)',
      'Drag & drop reorder, lightbox navigacija',
      'Sekvencijalni upload više attachmenta',
    ],
  },
  {
    version: '1.2.0',
    date: 'Juli 2026',
    items: [
      'Export/import workflowa kao JSON',
      'Snapshot metadata u Settings-u',
    ],
  },
  {
    version: '1.1.0',
    date: 'Juli 2026',
    items: [
      'Bulk mod sa background Service Worker processingom',
      'Per-row status, progress persistencija, retry failed',
      'Desktop notifikacija po završetku',
    ],
  },
  {
    version: '1.0.0',
    date: 'Juli 2026',
    items: [
      'Inicijalno izdanje — Single Task, Settings, Workflow CRUD',
      'Screenshot capture, JPEG kompresija, Jira API integracija',
    ],
  },
];

function ChangelogSection() {
  return (
    <div>
      <SectionTitle>Changelog</SectionTitle>
      <Subtitle>All notable changes to JiraWM.</Subtitle>

      {CHANGELOG_DATA.map((release, idx) => (
        <div key={release.version}>
          {idx > 0 && <Divider />}
          <div
            style={{
              background: 'var(--chrome-surface)',
              border: '1px solid var(--chrome-border)',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--chrome-text-primary)',
                }}
              >
                v{release.version}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--chrome-text-secondary)',
                }}
              >
                {release.date}
              </span>
              {release.major && (
                <span
                  style={{
                    background: 'var(--chrome-blue)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                  }}
                >
                  Major release
                </span>
              )}
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '13px',
                lineHeight: 1.8,
                color: 'var(--chrome-text-primary)',
              }}
            >
              {release.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
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

export default function Help() {
  const [activeSection, setActiveSection] = useState<HelpSection>('intro');

  return (
    <div className="flex h-full">
      <style>{SCROLLBAR_CSS}</style>

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
  );
}
