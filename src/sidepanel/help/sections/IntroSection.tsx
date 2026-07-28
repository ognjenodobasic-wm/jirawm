import { ActionList, Card, SectionTitle, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function IntroSection() {
  return (
    <div>
      <SectionTitle>What is JiraWM?</SectionTitle>
      <Subtitle>
        A browser extension that cuts the friction out of logging UI bugs and tasks to Jira.
      </Subtitle>

      <Text>
        The tab bar shows <strong>Task</strong>, <strong>Bulk</strong>, <strong>Comment</strong>{' '}
        and <strong>Workflows</strong> on the left, with <strong>Help</strong> and the{' '}
        <strong>⚙️</strong> settings button on the right. Below the tabs, a sticky row shows the
        selected workflow with “+ New” and “Edit” links — it only appears on the Task and Bulk
        tabs.
      </Text>

      <Card>
        <h3 style={cardHeadingStyle}>The five tabs</h3>
        <ActionList
          items={[
            <>
              <strong>Task:</strong> Capture the current tab or upload files, add a summary,
              and create one Jira task.
            </>,
            <>
              <strong>Bulk Upload:</strong> Drop a folder of screenshots and turn each one into a
              separate Jira task in the background.
            </>,
            <>
              <strong>Comment:</strong> Post a comment to an existing Jira task with a
              project/issue picker, reused screenshot capture, and filename-based shortcode
              tokens that link to a thumbnail preview.
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
