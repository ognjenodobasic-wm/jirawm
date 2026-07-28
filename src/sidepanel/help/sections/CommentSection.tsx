import { ActionList, Card, Divider, SectionTitle, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function CommentSection() {
  return (
    <div>
      <SectionTitle>Comment</SectionTitle>
      <Subtitle>Post a comment to an existing Jira task without creating a new issue.</Subtitle>

      <ActionList
        items={[
          <>
            <span style={{ marginRight: '6px' }}>1️⃣</span>
            <strong>Pick a project and issue</strong> — Choose a project, then find the target
            issue with a fuzzy search by key or summary.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>📷</span>
            <strong>Capture or add screenshots</strong> — Same <strong>Capture</strong>/
            <strong>Add</strong>/edit flow as the Task tab. Each screenshot appears as a thumbnail
            in the strip.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>✏️</span>
            <strong>Write the comment</strong> — Type your comment text. Optionally click a
            screenshot's shortcode chip (e.g. <strong>[1-filename.jpg]</strong>) to insert that
            exact token at the cursor position.
          </>,
          <>
            <span style={{ marginRight: '6px' }}>🚀</span>
            <strong>Submit</strong> — Post the comment. All screenshots attach to the issue,
            regardless of whether their token appears in the text.
          </>,
        ]}
      />

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Shortcode tokens</h3>
        <Text>
          Each screenshot gets a token that matches its real attachment filename on Jira. If you
          leave the token in the comment text, it becomes a clickable link to a 1400x1400
          thumbnail preview of that screenshot — not the full-resolution original. That's an
          intentional tradeoff: it gives you an inline preview instead of forcing a download.
          Screenshots you don't reference with a token still attach to the issue normally; they
          just won't have a link in the comment body.
        </Text>
      </Card>

      <Card>
        <h3 style={cardHeadingStyle}>After posting</h3>
        <Text>
          The success view shows a link to the new comment, plus two buttons: "New comment on
          {' '}{'{issue}'}" keeps the same issue selected and clears the form, while "New comment"
          resets everything, including the project and issue selection.
        </Text>
      </Card>
    </div>
  );
}
