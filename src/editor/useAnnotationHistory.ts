import { useCallback, useRef, useState } from 'react';
import * as fabric from 'fabric';

interface UseAnnotationHistoryParams {
  canvasInstanceRef: React.RefObject<fabric.Canvas | null>;
  onCanvasChanged: () => void;
  onBackgroundRestored: (el: HTMLImageElement) => void;
}

export function useAnnotationHistory({
  canvasInstanceRef,
  onCanvasChanged,
  onBackgroundRestored,
}: UseAnnotationHistoryParams) {
  const historyRef = useRef<string[]>([]);
  const historyCursorRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const resetHistory = useCallback((canvas: fabric.Canvas) => {
    const initial = JSON.stringify(canvas.toJSON());
    historyRef.current = [initial];
    historyCursorRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const snapshot = JSON.stringify(canvas.toJSON());
    historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
    historyRef.current.push(snapshot);
    historyCursorRef.current++;
    setCanUndo(historyCursorRef.current > 0);
    setCanRedo(false);
    onCanvasChanged();
  }, [canvasInstanceRef, onCanvasChanged]);

  const commitHistoryPair = useCallback((beforeSnapshot: string) => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
    historyRef.current.push(beforeSnapshot);
    historyRef.current.push(JSON.stringify(canvas.toJSON()));
    historyCursorRef.current += 2;
    setCanUndo(historyCursorRef.current > 0);
    setCanRedo(false);
    onCanvasChanged();
  }, [canvasInstanceRef, onCanvasChanged]);

  const applySnapshot = useCallback((snapshot: string) => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const parsed = JSON.parse(snapshot) as fabric.Object;
    void canvas.loadFromJSON(parsed).then(() => {
      const bg = canvas.backgroundImage;
      if (bg instanceof fabric.FabricImage) {
        onBackgroundRestored(bg.getElement() as HTMLImageElement);
      }
      canvas.renderAll();
      setCanUndo(historyCursorRef.current > 0);
      setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
      onCanvasChanged();
    });
  }, [canvasInstanceRef, onBackgroundRestored, onCanvasChanged]);

  const undo = useCallback(() => {
    if (historyCursorRef.current <= 0) return;
    historyCursorRef.current--;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) applySnapshot(snapshot);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyCursorRef.current >= historyRef.current.length - 1) return;
    historyCursorRef.current++;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) applySnapshot(snapshot);
  }, [applySnapshot]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      saveHistory();
    }
  }, [canvasInstanceRef, saveHistory]);

  return { canUndo, canRedo, resetHistory, saveHistory, commitHistoryPair, undo, redo, deleteSelected };
}
