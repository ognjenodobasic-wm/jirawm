import type { AppSettings, ScreenshotItem, WindowBounds, Workflow } from '../../types';
import { getLocal } from '../../lib/storage';

export interface HistoryEntry {
  key: string;
  summary: string;
  url: string;
}

export interface SingleTabState {
  screenshots: ScreenshotItem[];
  selectedId: string | null;
  summary: string;
  assignee: string | null;
  description: string;
}

export interface SingleModeProps {
  workflows: Workflow[];
  selectedWorkflowId: string;
  isAuthed: boolean;
  onOpenSettings: () => void;
  state: SingleTabState;
  onStateChange: React.Dispatch<React.SetStateAction<SingleTabState>>;
}

export const MAX_SCREENSHOTS = 10;

export async function readEditorBounds(): Promise<WindowBounds | null> {
  return getLocal<WindowBounds>('editorWindowBounds');
}

export function buildImageSettings(app: AppSettings | null, workflow: Workflow | null) {
  const quality = workflow?.compression.quality ?? app?.image.quality ?? 0.85;
  const maxWidth = workflow?.compression.maxWidth ?? app?.image.maxWidth ?? 1920;
  const transparencyFill = app?.image.transparencyFill ?? 'white';
  return { quality, maxWidth, transparencyFill };
}
