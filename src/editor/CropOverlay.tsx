import type { CropRect } from './useCropTool';

interface CropBannerProps {
  cropSelection: CropRect | null;
  onApply: () => void;
  onCancel: () => void;
}

export function CropBanner({ cropSelection, onApply, onCancel }: CropBannerProps) {
  const selectionTooSmall = !cropSelection || cropSelection.width < 20 || cropSelection.height < 20;
  return (
    <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#fff3cd', borderBottom: '1px solid #e6c200' }}>
      <span style={{ fontSize: 11, color: '#5c4a00' }}>Click and drag to draw a crop zone</span>
      <button
        onClick={onApply}
        disabled={selectionTooSmall}
        style={{
          padding: '3px 10px',
          fontSize: 11,
          border: 'none',
          borderRadius: 4,
          background: 'var(--chrome-blue)',
          color: '#fff',
          cursor: selectionTooSmall ? 'not-allowed' : 'pointer',
          opacity: selectionTooSmall ? 0.5 : 1,
        }}
      >
        Apply
      </button>
      <button
        onClick={onCancel}
        style={{
          padding: '3px 10px',
          fontSize: 11,
          border: '1px solid var(--chrome-border)',
          borderRadius: 4,
          background: 'transparent',
          color: 'var(--chrome-text-primary)',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

interface CropSelectionBoxProps {
  cropSelection: CropRect;
}

export function CropSelectionBox({ cropSelection }: CropSelectionBoxProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: cropSelection.x,
        top: cropSelection.y,
        width: cropSelection.width,
        height: cropSelection.height,
        border: '1px solid #ffffff',
        background: 'transparent',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
        pointerEvents: 'none',
      }}
    />
  );
}
