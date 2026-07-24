import { useEffect, useState } from 'react';
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

export default function AssigneeSelect({ projectKey, value, onChange, disabled, liveUsers }: AssigneeSelectProps) {
  const [users, setUsers] = useState<JiraUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (liveUsers && liveUsers.length > 0) return;

    if (!projectKey) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getLocal<JiraUser[]>(cacheKey(projectKey))
      .then((cached) => {
        if (cancelled) return;
        if (cached && cached.length > 0) {
          setUsers(cached);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectKey, liveUsers]);

  const sourceUsers = liveUsers && liveUsers.length > 0 ? liveUsers : users;
  const sortedUsers = [...sourceUsers].sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (error && users.length === 0) {
    return (
      <select
        disabled
        style={{
          width: '100%',
          border: '1px solid var(--chrome-border)',
          borderRadius: '4px',
          padding: '4px 6px',
          fontSize: '12px',
          background: 'var(--chrome-bg)',
          color: 'var(--chrome-text-secondary)',
        }}
      >
        <option>Failed to load users</option>
      </select>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
      style={{
        width: '100%',
        border: '1px solid var(--chrome-border)',
        borderRadius: '4px',
        padding: '4px 6px',
        fontSize: '12px',
        background: 'var(--chrome-bg)',
        color: 'var(--chrome-text-primary)',
        outline: 'none',
        boxSizing: 'border-box',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <option value="">— Unassigned —</option>
      {sortedUsers.map((user) => (
        <option key={user.accountId} value={user.accountId}>
          {user.displayName}
        </option>
      ))}
    </select>
  );
}
