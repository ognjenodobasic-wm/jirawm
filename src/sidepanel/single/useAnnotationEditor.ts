import { useEffect, useState } from 'react';
import type { AnnotationResult, AppSettings, MetadataOverrides, ScreenshotItem } from '../../types';
import { getLocal, setLocal } from '../../lib/storage';
import { readEditorBounds } from './types';

interface UseAnnotationEditorArgs {
  screenshots: ScreenshotItem[];
  setScreenshots: (next: ScreenshotItem[] | ((prev: ScreenshotItem[]) => ScreenshotItem[])) => void;
  appSettings: AppSettings | null;
}

const PENDING_EDITOR_KEY = 'pendingEditor';
const ANNOTATION_RESULT_KEY = 'annotationResult';

export function useAnnotationEditor({ screenshots, setScreenshots, appSettings }: UseAnnotationEditorArgs) {
  const [editorWindowId, setEditorWindowId] = useState<number | null>(null);

  // Cleanup stale pending editor handoff from previous sessions.
  // annotationResult is removed only after Side Panel reads and applies/discards it.
  useEffect(() => {
    chrome.storage.local.remove([PENDING_EDITOR_KEY]);
  }, []);

  useEffect(() => {
    let handlingAnnotationDone = false;

    const consumeAnnotationResult = async (): Promise<void> => {
      if (handlingAnnotationDone) return;
      handlingAnnotationDone = true;
      try {
        const annotationResult = await getLocal<AnnotationResult>(ANNOTATION_RESULT_KEY);
        if (annotationResult) {
          const { dataUrl, screenshotId } = annotationResult;
          setScreenshots((prev) => {
            const exists = prev.some((s) => s.id === screenshotId);
            if (!exists) {
              // Screenshot was deleted while editor was open; discard result silently.
              return prev;
            }
            return prev.map((s) => (s.id === screenshotId ? { ...s, dataUrl, annotated: true } : s));
          });
          await new Promise<void>((resolve) => {
            chrome.storage.local.remove([PENDING_EDITOR_KEY, ANNOTATION_RESULT_KEY], () => resolve());
          });
        }
      } finally {
        setEditorWindowId(null);
        handlingAnnotationDone = false;
      }
    };

    const listener = (msg: Record<string, unknown>): void => {
      if (msg.type === 'ANNOTATION_DONE') {
        void consumeAnnotationResult();
      } else if (msg.type === 'CAPTURE_DETAILS_UPDATED') {
        const { screenshotId, overrides } = msg as {
          type: string;
          screenshotId: string;
          overrides: MetadataOverrides | null;
        };
        setScreenshots((prev) =>
          prev.map((s) => (s.id === screenshotId ? { ...s, metadataOverrides: overrides } : s)),
        );
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setScreenshots]);

  // Clear stale editorWindowId when user closes the popup manually
  useEffect(() => {
    function handleWindowRemoved(windowId: number) {
      setEditorWindowId((prev) => (prev === windowId ? null : prev));
    }
    chrome.windows.onRemoved.addListener(handleWindowRemoved);
    return () => chrome.windows.onRemoved.removeListener(handleWindowRemoved);
  }, []);

  async function openEditor(index: number) {
    if (editorWindowId !== null) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.windows.update(editorWindowId, { focused: true }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          });
        });
        return;
      } catch {
        setEditorWindowId(null);
      }
    }
    const screenshot = screenshots[index];
    if (!screenshot) return;

    // Explicit safe cleanup: clear any stale previous result before starting a new editor session.
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove([ANNOTATION_RESULT_KEY], () => resolve());
    });

    await setLocal(PENDING_EDITOR_KEY, {
      dataUrl: screenshot.dataUrl,
      screenshotId: screenshot.id,
      origin: screenshot.origin,
      metadata: screenshot.metadata,
      metadataOverrides: screenshot.metadataOverrides,
      captureDetailsSettings: appSettings?.captureDetails ?? null,
    });
    const bounds = await readEditorBounds();
    const createData: chrome.windows.CreateData = {
      type: 'popup',
      url: chrome.runtime.getURL('editor.html'),
      width: bounds?.width ?? 1000,
      height: bounds?.height ?? 700,
    };
    if (bounds?.left != null) createData.left = bounds.left;
    if (bounds?.top != null) createData.top = bounds.top;
    chrome.windows.create(createData, (win) => {
      setEditorWindowId(win?.id ?? null);
    });
  }

  return { openEditor };
}
