import { useEffect, useRef, useState } from 'react';
import type { JiraUser } from '../../types';
import { getLocal } from '../../lib/storage';

interface AssigneeSelectProps {
  projectKey: string;
  value: string | null;
  onChange: (accountId: string | null) => void;
  disabled?: boolean;
  liveUsers?: JiraUser[];
}

function cacheKey(projectKey: string): string {
  return `assignableUsers_${projectKey}`;
}

const rowStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--chrome-border)',
  cursor: 'pointer',
  color: 'var(--chrome-text-primary)',
  fontSize: '12px',
  padding: '5px 6px',
  textAlign: 'left',
  width: '100%',
};

export default function AssigneeSelect({ projectKey, value, onChange, disabled, liveUsers }: AssigneeSelectProps) {
  const [cachedUsers, setCachedUsers] = useState<JiraUser[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load from cache when no liveUsers
  useEffect(() => {
    if (liveUsers && liveUsers.length > 0) return;
    if (!projectKey) { setCachedUsers([]); return; }

    getLocal<JiraUser[]>(cacheKey(projectKey))
      .then((cached) => { if (cached && cached.length > 0) setCachedUsers(cached); })
      .catch(() => {});
  }, [projectKey, liveUsers]);

  const allUsers = (liveUsers && liveUsers.length > 0 ? liveUsers : cachedUsers)
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Sync input display value when value prop changes
  useEffect(() => {
    if (!value) {
      setInputValue('');
      return;
    }
    const match = allUsers.find((u) => u.accountId === value);
    setInputValue(match ? match.displayName : value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allUsers.length]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Restore display name if a value is selected but user blurred without picking
        if (value) {
          const match = allUsers.find((u) => u.accountId === value);
          setInputValue(match ? match.displayName : value);
        } else {
          setInputValue('');
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [value, allUsers]);

  const q = inputValue.toLowerCase();
  const filtered = allUsers.filter((u) => u.displayName.toLowerCase().includes(q));

  function select(accountId: string | null, displayName: string) {
    onChange(accountId);
    setInputValue(accountId ? displayName : '');
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input row */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={inputValue}
          placeholder="Search assignee…"
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid var(--chrome-border)',
            borderRadius: '4px',
            padding: '4px 24px 4px 6px',
            fontSize: '12px',
            background: 'var(--chrome-bg)',
            color: 'var(--chrome-text-primary)',
            outline: 'none',
            opacity: disabled ? 0.6 : 1,
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => select(null, '')}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--chrome-text-secondary)',
              fontSize: '14px',
              lineHeight: 1,
              padding: '0 2px',
            }}
            aria-label="Clear assignee"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            border: '1px solid var(--chrome-border)',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            background: 'var(--chrome-bg)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <button type="button" onClick={() => select(null, '')} style={rowStyle}>
            — Unassigned —
          </button>
          {filtered.length === 0 ? (
            <div style={{ ...rowStyle, cursor: 'default', color: 'var(--chrome-text-secondary)', border: 'none' }}>
              No users found
            </div>
          ) : (
            filtered.map((user) => (
              <button
                key={user.accountId}
                type="button"
                onClick={() => select(user.accountId, user.displayName)}
                style={{
                  ...rowStyle,
                  fontWeight: user.accountId === value ? 600 : 400,
                }}
              >
                {user.displayName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
