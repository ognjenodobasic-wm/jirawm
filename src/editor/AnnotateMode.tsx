import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import type { PendingEditor, MetadataOverrides } from '../types';
import { buildCaptureDetailFields } from '../lib/capture-adf';
import CaptureDetailsPanel from './CaptureDetailsPanel';
import { setLocal } from '../lib/storage';
import { normalizeOverrides, overridesEqual } from './annotationOverrides';
import { exportAnnotatedImage } from './imageExport';
import { useAnnotationHistory } from './useAnnotationHistory';
import { useDrawingTools, type Tool } from './useDrawingTools';
import { useCropTool } from './useCropTool';
import AnnotateToolbar, { TOOLBAR_HEIGHT } from './AnnotateToolbar';
import { CropBanner, CropSelectionBox } from './CropOverlay';
import ConfirmDiscardDialog from './ConfirmDiscardDialog';

const PANEL_WIDTH = 300;

interface AnnotateModeProps {
  pending: PendingEditor;
  onClose: () => Promise<void>;
}

interface SavedResult {
  imageDirty: boolean;
  overridesDirty: boolean;
  resultDataUrl: string | null;
  overrides: MetadataOverrides | null;
}

export default function AnnotateMode({ pending, onClose }: AnnotateModeProps) {
  const { dataUrl, screenshotId, origin, metadata, metadataOverrides, captureDetailsSettings } = pending;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const scaleRef = useRef<number>(1);

  const [activeTool, setActiveTool] = useState<Tool>('arrow');
  const [canvasReady, setCanvasReady] = useState(false);
  const [activeColor, setActiveColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState<2 | 3 | 4>(2);
  const [markerCounter, setMarkerCounter] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [imageCropped, setImageCropped] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isClosingIntentionallyRef = useRef(false);

  // Capture details state
  const initialOverridesRef = useRef<MetadataOverrides | null>(normalizeOverrides(metadataOverrides));
  const [workingOverrides, setWorkingOverrides] = useState<MetadataOverrides | null>(initialOverridesRef.current);

  const panelVisible =
    origin === 'capture' &&
    metadata !== null &&
    captureDetailsSettings !== null &&
    captureDetailsSettings.enabled;

  const resolvedFields =
    panelVisible && metadata && captureDetailsSettings
      ? buildCaptureDetailFields(
          {
            id: screenshotId,
            dataUrl: '',
            origin: 'capture',
            metadata,
            metadataOverrides: workingOverrides,
            number: null,
            filename: '',
          },
          captureDetailsSettings,
        )
      : [];

  const allowEdit = captureDetailsSettings?.allowPerScreenshotEdit ?? false;
  const showPanel = panelVisible && resolvedFields.length > 0;

  const detailsDirty = showPanel && allowEdit
    ? !overridesEqual(workingOverrides, initialOverridesRef.current)
    : false;

  // canvasDirty  -> annotation objects exist; gates drawing-state affordances (crop, delete)
  // detailsDirty -> Capture Details panel has pending edits
  // hasUnsavedWork -> either kind of unsaved work; gates Save/Cancel and all exit confirms
  const hasUnsavedWork = canvasDirty || detailsDirty || imageCropped;

  const updateCanvasDirty = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    setCanvasDirty(canvas.getObjects().length > 0);
  }, []);

  const resetMarkerCounter = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    let max = 0;
    for (const obj of objects) {
      if (obj instanceof fabric.Group) {
        for (const child of obj.getObjects()) {
          if (child instanceof fabric.Text && !Number.isNaN(Number(child.text))) {
            max = Math.max(max, Number(child.text));
          }
        }
      }
    }
    setMarkerCounter(max + 1);
  }, []);

  const handleResize = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return;
    const availW = (showPanel ? window.innerWidth - PANEL_WIDTH : window.innerWidth);
    const availH = window.innerHeight - TOOLBAR_HEIGHT;
    const scale = Math.min(availW / naturalW, availH / naturalH, 1);
    scaleRef.current = scale;
    canvas.setDimensions({
      width: Math.round(naturalW * scale),
      height: Math.round(naturalH * scale),
    });
    if (canvas.backgroundImage instanceof fabric.FabricImage) {
      canvas.backgroundImage.set({ scaleX: scale, scaleY: scale });
    }
    canvas.renderAll();
  }, [showPanel]);

  const handleBackgroundRestored = useCallback((el: HTMLImageElement) => {
    naturalSizeRef.current = { w: el.naturalWidth, h: el.naturalHeight };
    handleResize();
  }, [handleResize]);

  const { canUndo, canRedo, resetHistory, saveHistory, commitHistoryPair, undo, redo, deleteSelected } =
    useAnnotationHistory({
      canvasInstanceRef,
      onCanvasChanged: updateCanvasDirty,
      onBackgroundRestored: handleBackgroundRestored,
    });

  const {
    cropMode,
    cropSelection,
    startCropMode,
    cancelCrop,
    applyCrop,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp,
  } = useCropTool({
    canvasInstanceRef,
    containerRef,
    canvasRef,
    naturalSizeRef,
    scaleRef,
    handleResize,
    commitHistoryPair,
    setImageCropped,
    setActiveTool,
  });

  useDrawingTools({
    canvasInstanceRef,
    activeTool,
    activeColor,
    strokeWidth,
    markerCounter,
    saveHistory,
    cropMode,
    canvasReady,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvasEl = canvasRef.current;

    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      naturalSizeRef.current = { w: naturalW, h: naturalH };

      const availW = (showPanel ? window.innerWidth - PANEL_WIDTH : window.innerWidth);
      const availH = window.innerHeight - TOOLBAR_HEIGHT;
      const scale = Math.min(availW / naturalW, availH / naturalH, 1);
      scaleRef.current = scale;

      const displayW = Math.round(naturalW * scale);
      const displayH = Math.round(naturalH * scale);

      const fabricCanvas = new fabric.Canvas(canvasEl, {
        width: displayW,
        height: displayH,
        selection: true,
        preserveObjectStacking: true,
      });
      canvasInstanceRef.current = fabricCanvas;

      const fabricImg = new fabric.FabricImage(img, {
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });
      fabricCanvas.backgroundImage = fabricImg;
      fabricCanvas.renderAll();

      resetHistory(fabricCanvas);
      setCanvasDirty(false);

      fabricCanvas.on('object:modified', () => saveHistory());
      fabricCanvas.on('object:added', () => { resetMarkerCounter(); updateCanvasDirty(); });
      fabricCanvas.on('object:removed', () => { resetMarkerCounter(); updateCanvasDirty(); });
      setCanvasReady(true);
    };
    img.src = dataUrl;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInstanceRef.current?.dispose();
      canvasInstanceRef.current = null;
      setCanvasReady(false);
    };
  }, [dataUrl, saveHistory, resetHistory, resetMarkerCounter, updateCanvasDirty, handleResize, showPanel]);

  useEffect(() => {
    handleResize();
  }, [showPanel, handleResize]);

  useEffect(() => {
    handleResize();
  }, [cropMode, handleResize]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;
    const cropActive = cropMode;
    canvas.selection = activeTool === 'select' && !cropActive;
    canvas.forEachObject((obj) => {
      obj.selectable = activeTool === 'select' && !cropActive;
      obj.evented = activeTool === 'select' && !cropActive;
    });
    canvas.discardActiveObject();
    canvas.renderAll();
  }, [activeTool, cropMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select'
        || (e.target as HTMLElement).isContentEditable;
      if (isEditable) return;

      if (cropMode) {
        if (e.key === 'Escape') { cancelCrop(); return; }
        return;
      }
      if (e.key === 'Escape') { handleExitRequest(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, undo, redo, deleteSelected, cropMode, hasUnsavedWork]); // eslint-disable-line react-hooks/exhaustive-deps — handleExitRequest is intentionally excluded; it is not memoized and including it would reattach the keydown listener every render

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedWork && !isClosingIntentionallyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedWork]);

  function handleExitRequest() {
    if (hasUnsavedWork) setShowConfirm(true);
    else void onClose();
  }

  function buildSavedResult(): SavedResult {
    const canvas = canvasInstanceRef.current;
    const imageDirty = (canvas ? canvas.getObjects().length > 0 : false) || imageCropped;
    const overridesDirty = showPanel && allowEdit
      ? !overridesEqual(workingOverrides, initialOverridesRef.current)
      : false;
    return { imageDirty, overridesDirty, resultDataUrl: null, overrides: overridesDirty ? normalizeOverrides(workingOverrides) : null };
  }

  const handleDone = () => {
    if (isSaving) return;
    setIsSaving(true);

    void (async () => {
      try {
        const result: SavedResult = buildSavedResult();
        if (result.imageDirty) {
          const canvas = canvasInstanceRef.current;
          if (!canvas) throw new Error('No canvas');
          result.resultDataUrl = await exportAnnotatedImage(canvas, naturalSizeRef.current, scaleRef.current);
        }

        if (result.resultDataUrl) {
          await setLocal('annotationResult', { dataUrl: result.resultDataUrl, screenshotId });
          await chrome.runtime.sendMessage({ type: 'ANNOTATION_DONE' }).catch((err) => {
            console.error('Failed to send ANNOTATION_DONE message:', err);
          });
        }
        if (result.overridesDirty) {
          await chrome.runtime.sendMessage({
            type: 'CAPTURE_DETAILS_UPDATED',
            screenshotId,
            overrides: result.overrides,
          }).catch((err) => {
            console.error('Failed to send CAPTURE_DETAILS_UPDATED message:', err);
          });
        }

        isClosingIntentionallyRef.current = true;
        await onClose();
      } catch (err) {
        console.error('handleDone failed:', err);
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const cropDisabled = canvasDirty;

  const mainContentHeight = cropMode
    ? `calc(100vh - ${TOOLBAR_HEIGHT + 32}px)`
    : `calc(100vh - ${TOOLBAR_HEIGHT}px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e', overflow: 'hidden' }}>
      <AnnotateToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        cropDisabled={cropDisabled}
        startCropMode={startCropMode}
        markerCounter={markerCounter}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        hasUnsavedWork={hasUnsavedWork}
        isSaving={isSaving}
        handleDone={handleDone}
        handleExitRequest={handleExitRequest}
      />

      {cropMode && (
        <CropBanner cropSelection={cropSelection} onApply={applyCrop} onCancel={cancelCrop} />
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div
          ref={containerRef}
          onMouseDown={handleCropMouseDown}
          onMouseMove={handleCropMouseMove}
          onMouseUp={handleCropMouseUp}
          onMouseLeave={handleCropMouseUp}
          style={{
            flex: 1,
            minWidth: 0,
            height: mainContentHeight,
            overflow: 'hidden',
            background: '#1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <canvas ref={canvasRef} />
          {cropMode && cropSelection && <CropSelectionBox cropSelection={cropSelection} />}
        </div>

        {showPanel && metadata && captureDetailsSettings && (
          <CaptureDetailsPanel
            metadata={metadata}
            settings={captureDetailsSettings}
            allowEdit={allowEdit}
            value={workingOverrides}
            onChange={(next) => setWorkingOverrides(normalizeOverrides(next))}
          />
        )}
      </div>

      {showConfirm && (
        <ConfirmDiscardDialog
          onKeepEditing={() => setShowConfirm(false)}
          onDiscard={() => { setShowConfirm(false); void onClose(); }}
        />
      )}
    </div>
  );
}
