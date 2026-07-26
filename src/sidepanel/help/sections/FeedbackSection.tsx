import { ActionList, Card, Divider, SectionTitle, Subtitle, Text } from '../primitives';

export default function FeedbackSection() {
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
