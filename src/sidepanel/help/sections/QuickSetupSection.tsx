import { Card, CodeBlock, Divider, SectionTitle, SmallText, Step, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function QuickSetupSection() {
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
