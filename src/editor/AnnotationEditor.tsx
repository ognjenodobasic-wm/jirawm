import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/globals.css';

function AnnotationEditor() {
  return (
    <div className="p-4 bg-[var(--chrome-bg)] text-[var(--chrome-text-primary)]">
      <h1 className="text-sm font-semibold">Annotation Editor</h1>
      <p className="text-xs text-[var(--chrome-text-secondary)] mt-1">Coming soon.</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AnnotationEditor />
    </StrictMode>
  );
}

export default AnnotationEditor;
