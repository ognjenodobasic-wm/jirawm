import { ActionList, Card, Divider, SectionTitle, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function ScreenshotSection() {
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
          screenshot API — no external tool, no clipboard, no switching apps. If page access
          hasn't been granted yet, clicking Capture triggers a one-time Chrome permission prompt.
          You can also click Add to upload an existing image from disk instead.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Image format</h3>
        <Text>
          Every image entering the extension is converted to JPEG. Drop in PNGs, screenshots from
          any tool, or exported designs — they all work. Quality and max width are controlled in
          Settings → Image handling.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Screenshot strip</h3>
        <Text>
          Each screenshot appears as a thumbnail in the strip below the buttons. Click a thumbnail
          to open it in the editor. Three overlays give you information at a glance:
        </Text>
        <ActionList
          items={[
            <span key="annotated"><strong>✎</strong> top-left — the screenshot has been annotated</span>,
            <span key="edited"><strong style={{ color: 'var(--chrome-blue)' }}>●</strong> top-right (blue dot) — capture details were edited for this screenshot</span>,
            <span key="numbered"><strong>1 2 3</strong> bottom-left — sequence number (see Settings → Screenshot naming)</span>,
          ]}
        />
        <Text>
          The × in the corner removes the thumbnail. Sequence numbers do not renumber after a
          deletion — if you remove screenshot 2, the next one you take is 4.
        </Text>
      </Card>

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Crop</h3>
        <Text>
          Open a thumbnail, then activate Crop before drawing anything. Drag a selection, then
          click Apply. Dragging again replaces the current selection. Crop is disabled once you
          have drawn annotations — this prevents your work from being cut away. Undo after a crop
          restores the full original.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>Annotations</h3>
        <Text>
          The editor lets you add arrows, rectangles, filled shapes, text labels, and numbered
          markers — with full undo/redo and keyboard shortcuts. When you click Done, the annotated
          version replaces the thumbnail in the strip. The ✎ badge confirms the screenshot has
          been edited.
        </Text>
      </Card>
    </div>
  );
}
