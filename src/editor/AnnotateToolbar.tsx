import type React from 'react';
import type { Tool } from './useDrawingTools';

export const TOOLBAR_HEIGHT = 56;
export const COLORS = ['#ff4444', '#ffcc00', '#00cc88', '#4499ff', '#ffffff'];

const TOOL_ICONS: Partial<Record<Tool, React.ReactElement>> = {
  select: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
  ),
  rect: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>
  ),
  rectFill: (
    <svg viewBox="0 0 24 24" width="14" height="14"><rect x="4" y="6" width="16" height="12" rx="1" fill="currentColor"/></svg>
  ),
  marker: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="5"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
  ),
};

interface AnnotateToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  cropDisabled: boolean;
  startCropMode: () => void;
  markerCounter: number;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: 2 | 3 | 4;
  setStrokeWidth: (width: 2 | 3 | 4) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  hasUnsavedWork: boolean;
  isSaving: boolean;
  handleDone: () => void;
  handleExitRequest: () => void;
}

export default function AnnotateToolbar({
  activeTool,
  setActiveTool,
  cropDisabled,
  startCropMode,
  markerCounter,
  activeColor,
  setActiveColor,
  strokeWidth,
  setStrokeWidth,
  canUndo,
  canRedo,
  undo,
  redo,
  hasUnsavedWork,
  isSaving,
  handleDone,
  handleExitRequest,
}: AnnotateToolbarProps) {
  const toolButton = (tool: Tool, label: string, disabled = false, title?: string) => {
    const isActive = activeTool === tool;
    const icon = TOOL_ICONS[tool];
    return (
      <button
        key={tool}
        onClick={() => {
          if (disabled) return;
          if (tool === 'crop') startCropMode();
          else setActiveTool(tool);
        }}
        title={title ?? label}
        disabled={disabled}
        style={{
          padding: '6px 12px',
          border: `1px solid ${isActive ? 'var(--chrome-blue)' : 'var(--chrome-border)'}`,
          borderRadius: '4px',
          background: isActive ? 'var(--chrome-blue)' : 'transparent',
          color: isActive ? '#fff' : 'var(--chrome-text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {tool === 'crop' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
            <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
          </svg>
        )}
        {tool === 'crop' ? label : icon}
        {tool === 'marker' && (
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '8px' }}>
            M:{markerCounter}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ height: TOOLBAR_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--chrome-surface)', borderBottom: '1px solid var(--chrome-border)', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {toolButton('crop', 'Crop', cropDisabled, cropDisabled ? 'Crop before annotating' : undefined)}
        <div style={{ width: 1, height: 24, background: 'var(--chrome-border)' }} />
        {toolButton('select', 'Select')}
        {toolButton('arrow', 'Arrow')}
        {toolButton('rect', 'Rectangle')}
        {toolButton('rectFill', 'Fill')}
        {toolButton('marker', 'Numbers')}
        {toolButton('text', 'Text')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {COLORS.map((color) => (
          <button key={color} onClick={() => setActiveColor(color)} style={{ width: '18px', height: '18px', borderRadius: '50%', background: color, border: activeColor === color ? '2px solid #fff' : '1px solid var(--chrome-border)', cursor: 'pointer', boxShadow: activeColor === color ? '0 0 0 1px var(--chrome-blue)' : 'none' }} aria-label={`Select color ${color}`} />
        ))}
        <select value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value) as 2 | 3 | 4)} style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'var(--chrome-bg)', color: 'var(--chrome-text-primary)' }}>
          <option value={2}>2px</option>
          <option value={3}>3px</option>
          <option value={4}>4px</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={undo} disabled={!canUndo} title="Undo" style={{ padding: '6px 10px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: canUndo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo" style={{ padding: '6px 10px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: canRedo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)', cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
        </button>
        {hasUnsavedWork ? (
          <button onClick={handleDone} disabled={isSaving} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', background: isSaving ? 'var(--chrome-border)' : 'var(--chrome-blue)', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 500, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <button onClick={handleExitRequest} style={{ padding: '6px 14px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-text-primary)', cursor: 'pointer', fontSize: '12px' }}>Close</button>
        )}
      </div>
    </div>
  );
}
