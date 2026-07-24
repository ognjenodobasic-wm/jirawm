interface Props {
  onOpenSettings: () => void;
}

export function ConnectJiraPrompt({ onOpenSettings }: Props) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--chrome-text-secondary)',
        fontSize: '13px',
      }}
    >
      <p>
        Jira is not connected.{' '}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--chrome-blue)',
            cursor: 'pointer',
            fontSize: 'inherit',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none'; }}
        >
          Connect to Jira
        </button>{' '}
        to get started.
      </p>
    </div>
  );
}
