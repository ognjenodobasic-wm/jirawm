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
      }}
    >
      <p style={{ marginBottom: 12 }}>Connect Jira in Settings to get started</p>
      <button
        onClick={onOpenSettings}
        style={{
          background: 'var(--chrome-blue)',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        Open Settings
      </button>
    </div>
  );
}
