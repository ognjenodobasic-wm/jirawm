import { ActionList, Card, Divider, SectionTitle, Subtitle, Text, ToolRow, cardHeadingStyle } from '../primitives';

export default function EditorSection() {
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
            <ToolRow key="crop"
              name="Crop"
              description="Select a region and click Apply. Disabled once annotations exist."
              shortcut="C"
            />,
            <ToolRow key="select"
              name="Select"
              description="Click to select an existing annotation and move or delete it."
              shortcut="V"
            />,
            <ToolRow key="arrow" name="Arrow" description="Draw an arrow pointing at something." shortcut="A" />,
            <ToolRow key="rect"
              name="Rectangle"
              description="Draw an outline rectangle to highlight a region."
              shortcut="R"
            />,
            <ToolRow key="fill"
              name="Fill"
              description="Draw a solid filled rectangle (useful for blocking out sensitive info)."
              shortcut="F"
            />,
            <ToolRow key="marker"
              name="Marker"
              description="Place a numbered circle. Counters auto-increment: ①, ②, ③…"
              shortcut="M"
            />,
            <ToolRow key="text"
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
