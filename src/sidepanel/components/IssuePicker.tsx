import { useRef, useState } from 'react';
import type { AuthConfig } from '../../types';
import { getLocal } from '../../lib/storage';
import { setAuth, searchIssues } from '../../lib/jira';

interface IssuePickerProps {
  value: { key: string; summary: string } | null;
  onChange: (issue: { key: string; summary: string } | null) => void;
  projectId: string;
  projectKey: string;
  placeholder?: string;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; issues: Array<{ key: string; summary: string; isSubtask: boolean }> }
  | { status: 'error'; message: string };

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--chrome-border)',
  borderRadius: '4px',
  padding: '4px 6px',
  fontSize: '12px',
  background: 'var(--chrome-bg)',
  color: 'var(--chrome-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function IssuePicker({
  value,
  onChange,
  projectId,
  projectKey,
  placeholder = 'Search issue…',
}: IssuePickerProps) {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(next: string) {
    setQuery(next);
    setSearchState({ status: 'idle' });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (next.trim().length < 2) return;

    timerRef.current = setTimeout(async () => {
      setSearchState({ status: 'loading' });
      try {
        const auth = await getLocal<AuthConfig>('auth');
        if (auth) setAuth(auth);
        const issues = await searchIssues(next.trim(), projectId, projectKey);
        setSearchState({ status: 'ready', issues });
      } catch (err) {
        setSearchState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }, 400);
  }

  function selectIssue(key: string, summary: string, isSubtask: boolean) {
    if (isSubtask) return;
    onChange({ key, summary });
    setQuery('');
    setSearchState({ status: 'idle' });
  }

  function clearIssue() {
    onChange(null);
    setQuery('');
    setSearchState({ status: 'idle' });
  }

  if (value) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
        style={{
          border: '1px solid var(--chrome-border)',
          background: 'var(--chrome-surface)',
          color: 'var(--chrome-text-primary)',
        }}
      >
        <span className="truncate">
          {value.key} — {value.summary}
        </span>
        <button
          type="button"
          onClick={clearIssue}
          className="shrink-0"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--chrome-red)',
            fontSize: '14px',
            lineHeight: 1,
          }}
          aria-label="Clear issue"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {searchState.status === 'loading' && (
        <p className="text-xs" style={{ color: 'var(--chrome-text-secondary)' }}>
          Searching…
        </p>
      )}
      {searchState.status === 'error' && (
        <p className="text-xs" style={{ color: 'var(--chrome-red)' }}>
          ✗ {searchState.message}
        </p>
      )}
      {searchState.status === 'ready' && (
        <div
          className="flex flex-col rounded overflow-hidden"
          style={{
            border: '1px solid var(--chrome-border)',
            background: 'var(--chrome-bg)',
            maxHeight: '160px',
            overflowY: 'auto',
          }}
        >
          {searchState.issues.length === 0 ? (
            <div
              className="px-2 py-1.5 text-xs"
              style={{ color: 'var(--chrome-text-secondary)' }}
            >
              No issues found
            </div>
          ) : (
            searchState.issues.map((issue) => (
              <button
                key={issue.key}
                type="button"
                disabled={issue.isSubtask}
                onClick={() => selectIssue(issue.key, issue.summary, issue.isSubtask)}
                className="text-left px-2 py-1.5 text-xs"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--chrome-border)',
                  cursor: issue.isSubtask ? 'not-allowed' : 'pointer',
                  color: 'var(--chrome-text-primary)',
                  opacity: issue.isSubtask ? 0.5 : 1,
                }}
              >
                {issue.key} — {issue.summary}
                {issue.isSubtask && (
                  <span style={{ color: 'var(--chrome-text-secondary)' }}>
                    {' '}— sub-task, can't be selected
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
