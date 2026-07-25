import { useEffect, useState } from 'react';
import type { CaptureDetailKey, CaptureDetailsSettings, CaptureMetadata, MetadataOverrides } from '../types';
import type { CaptureDetailField } from '../lib/capture-adf';
import { buildCaptureDetailFields, hasMetadataOverrides } from '../lib/capture-adf';
import { getLocal, setLocal } from '../lib/storage';

const COLLAPSED_KEY = 'captureDetailsPanelCollapsed';

interface Props {
  metadata: CaptureMetadata;
  settings: CaptureDetailsSettings;
  allowEdit: boolean;
  value: MetadataOverrides | null;
  onChange: (overrides: MetadataOverrides | null) => void;
}

export default function CaptureDetailsPanel({
  metadata,
  settings,
  allowEdit,
  value,
  onChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getLocal<boolean>(COLLAPSED_KEY).then((val) => {
      if (val !== null) setCollapsed(val);
    });
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    void setLocal(COLLAPSED_KEY, next);
  }

  const syntheticItem = {
    id: '',
    dataUrl: '',
    origin: 'capture' as const,
    metadata,
    metadataOverrides: value,
    number: null,
    filename: '',
  };

  const fields = buildCaptureDetailFields(syntheticItem, settings);
  const anyOverrides = hasMetadataOverrides(syntheticItem);

  function handleValueChange(key: CaptureDetailKey, currentField: CaptureDetailField, newValue: string) {
    const next: MetadataOverrides = {
      ...(value ?? {}),
      [key]: { value: newValue, enabled: currentField.enabled },
    };
    onChange(next);
  }

  function handleToggle(key: CaptureDetailKey, currentField: CaptureDetailField) {
    const next: MetadataOverrides = {
      ...(value ?? {}),
      [key]: { value: currentField.value, enabled: !currentField.enabled },
    };
    onChange(next);
  }

  function handleRevert(key: CaptureDetailKey) {
    const next: MetadataOverrides = { ...(value ?? {}) };
    delete next[key];
    const cleanNext: MetadataOverrides | null = Object.keys(next).length > 0 ? next : null;
    onChange(cleanNext);
  }

  function handleResetAll() {
    onChange(null);
  }

  if (collapsed) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={toggleCollapsed}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCollapsed(); }}
        title="Show capture details"
        style={{
          width: 28,
          flexShrink: 0,
          borderLeft: '1px solid var(--chrome-border)',
          background: 'var(--chrome-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--chrome-text-secondary)',
            display: 'block',
            transform: 'rotate(-90deg)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          Details
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderLeft: '1px solid var(--chrome-border)',
        background: 'var(--chrome-surface)',
        overflowY: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--chrome-text-primary)' }}>
          Capture details
        </span>
        <button
          onClick={toggleCollapsed}
          title="Collapse panel"
          style={{
            width: 20,
            height: 20,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            color: 'var(--chrome-text-secondary)',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 4.5L6 8.5L10 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            allowEdit={allowEdit}
            onValueChange={(val) => handleValueChange(field.key, field, val)}
            onToggle={() => handleToggle(field.key, field)}
            onRevert={() => handleRevert(field.key)}
          />
        ))}
      </div>

      {allowEdit && anyOverrides && (
        <button
          onClick={handleResetAll}
          style={{
            marginTop: 12,
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 11,
            color: 'var(--chrome-blue)',
            cursor: 'pointer',
            textAlign: 'left',
            flexShrink: 0,
          }}
        >
          Reset all details
        </button>
      )}
    </div>
  );
}

interface FieldRowProps {
  field: CaptureDetailField;
  allowEdit: boolean;
  onValueChange: (val: string) => void;
  onToggle: () => void;
  onRevert: () => void;
}

function FieldRow({ field, allowEdit, onValueChange, onToggle, onRevert }: FieldRowProps) {
  if (!allowEdit) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--chrome-text-primary)' }}>
          {field.label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--chrome-text-secondary)',
            marginTop: 2,
            wordBreak: 'break-all',
          }}
        >
          {field.value || '—'}
        </div>
      </div>
    );
  }

  const inputDisabled = !field.enabled;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--chrome-text-primary)',
            textDecoration: inputDisabled ? 'line-through' : 'none',
          }}
        >
          {field.label}
        </span>
        <input
          type="checkbox"
          checked={field.enabled}
          onChange={onToggle}
          style={{ width: 14, height: 14, cursor: 'pointer', margin: 0, flexShrink: 0 }}
        />
      </div>
      <input
        type="text"
        value={field.value}
        disabled={inputDisabled}
        onChange={(e) => onValueChange(e.target.value)}
        title={field.key === 'url' ? field.value : undefined}
        style={{
          width: '100%',
          fontSize: 12,
          padding: '5px 7px',
          border: '1px solid var(--chrome-border)',
          borderRadius: 3,
          background: 'var(--chrome-bg)',
          color: 'var(--chrome-text-primary)',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: inputDisabled ? 0.45 : 1,
          cursor: inputDisabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => {
          if (!inputDisabled) e.currentTarget.style.borderColor = 'var(--chrome-blue)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--chrome-border)';
        }}
      />
      {field.isOverridden && (
        <div
          style={{
            marginTop: 3,
            fontSize: 10,
            color: 'var(--chrome-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Edited
          <button
            onClick={onRevert}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 10,
              color: 'var(--chrome-blue)',
              cursor: 'pointer',
            }}
          >
            revert
          </button>
        </div>
      )}
    </div>
  );
}
