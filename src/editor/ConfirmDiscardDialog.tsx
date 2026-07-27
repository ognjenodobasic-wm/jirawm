interface ConfirmDiscardDialogProps {
  onKeepEditing: () => void;
  onDiscard: () => void;
}

export default function ConfirmDiscardDialog({ onKeepEditing, onDiscard }: ConfirmDiscardDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: 'var(--chrome-bg)',
          border: '1px solid var(--chrome-border)',
          borderRadius: 8,
          padding: 20,
          minWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--chrome-text-primary)', margin: '0 0 16px' }}>
          Discard changes? This can’t be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onKeepEditing}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              border: '1px solid var(--chrome-border)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--chrome-text-primary)',
              cursor: 'pointer',
            }}
          >
            Keep editing
          </button>
          <button
            onClick={onDiscard}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              border: 'none',
              borderRadius: 4,
              background: 'var(--chrome-red)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
