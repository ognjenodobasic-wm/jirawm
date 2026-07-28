import { ActionList, Card, Divider, SectionTitle, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function SingleTaskSection() {
  return (
    <div>
      <SectionTitle>Task</SectionTitle>
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
