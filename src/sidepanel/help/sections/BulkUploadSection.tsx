import { ActionList, Card, Divider, SectionTitle, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function BulkUploadSection() {
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
          { icon: '✅', text: 'Success — task key shown as a green link' },
          { icon: '❌', text: 'Error — reason shown in red, retry button appears' },
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
        <h3 style={cardHeadingStyle}>While an upload is running</h3>
        <Text>
          A scanning progress indicator animates across the top of the panel so you can tell an
          upload is active even if you have scrolled down. Start Upload shows a spinner and
          disables itself to prevent double-clicks. Clicking Start Upload again on the same batch
          only processes rows that have not yet succeeded — already-completed rows are skipped.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Clearing the list</h3>
        <Text>
          The Clear All and Start Upload buttons stay pinned to the bottom of the panel. Clear All
          asks for confirmation if any rows have not finished successfully. Successfully completed
          rows are removed automatically the next time you add new screenshots, keeping the list
          focused on what is still in progress.
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
