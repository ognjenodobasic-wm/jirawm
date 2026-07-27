import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import type { PendingEditor, MetadataOverrides } from '../types';
import { buildCaptureDetailFields } from '../lib/capture-adf';
import CaptureDetailsPanel from './CaptureDetailsPanel';
import { setLocal } from '../lib/storage';

const TOOLBAR_HEIGHT = 56;
const COLORS = ['#ff4444', '#ffcc00', '#00cc88', '#4499ff', '#ffffff'];
const PANEL_WIDTH = 300;
type Tool = 'select' | 'crop' | 'arrow' | 'rect' | 'rectFill' | 'marker' | 'text';

interface AnnotateModeProps {
  pending: PendingEditor;
  onClose: () => Promise<void>;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SavedResult {
  imageDirty: boolean;
  overridesDirty: boolean;
  resultDataUrl: string | null;
  overrides: MetadataOverrides | null;
}

function normalizeOverrides(overrides: MetadataOverrides | null): MetadataOverrides | null {
  if (!overrides) return null;
  const keys = Object.keys(overrides) as Array<keyof MetadataOverrides>;
  if (keys.length === 0) return null;
  return overrides;
}

function overridesEqual(a: MetadataOverrides | null, b: MetadataOverrides | null): boolean {
  const na = normalizeOverrides(a);
  const nb = normalizeOverrides(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  const keysA = Object.keys(na).sort();
  const keysB = Object.keys(nb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i] as keyof MetadataOverrides;
    if (keysA[i] !== keysB[i]) return false;
    const va = na[key];
    const vb = nb[key];
    if (!va || !vb) return false;
    if (va.enabled !== vb.enabled || va.value !== vb.value) return false;
  }
  return true;
}

export default function AnnotateMode({ pending, onClose }: AnnotateModeProps) {
  const { dataUrl, screenshotId, origin, metadata, metadataOverrides, captureDetailsSettings } = pending;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const scaleRef = useRef<number>(1);

  const [activeTool, setActiveTool] = useState<Tool>('arrow');
  const [activeColor, setActiveColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState<2 | 3 | 4>(2);
  const [markerCounter, setMarkerCounter] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [imageCropped, setImageCropped] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isClosingIntentionallyRef = useRef(false);

  const historyRef = useRef<string[]>([]);
  const historyCursorRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const tempObjectRef = useRef<fabric.Object | null>(null);

  // Crop state
  const [cropSelection, setCropSelection] = useState<CropRect | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const saveHistory = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const snapshot = JSON.stringify(canvas.toJSON());
    historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
    historyRef.current.push(snapshot);
    historyCursorRef.current++;
    setCanUndo(historyCursorRef.current > 0);
    setCanRedo(false);
    updateCanvasDirty();
  }, [updateCanvasDirty]);

  const undo = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || historyCursorRef.current <= 0) return;
    historyCursorRef.current--;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) {
      const parsed = JSON.parse(snapshot) as fabric.Object;
      void canvas.loadFromJSON(parsed).then(() => {
        const bg = canvas.backgroundImage;
        if (bg instanceof fabric.FabricImage) {
          const el = bg.getElement() as HTMLImageElement;
          naturalSizeRef.current = { w: el.naturalWidth, h: el.naturalHeight };
          handleResize();
        }
        canvas.renderAll();
        setCanUndo(historyCursorRef.current > 0);
        setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
        updateCanvasDirty();
      });
    }
  }, [updateCanvasDirty]); // eslint-disable-line react-hooks/exhaustive-deps — handleResize is declared below, memoized, referentially stable

  const redo = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || historyCursorRef.current >= historyRef.current.length - 1) return;
    historyCursorRef.current++;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) {
      const parsed = JSON.parse(snapshot) as fabric.Object;
      void canvas.loadFromJSON(parsed).then(() => {
        const bg = canvas.backgroundImage;
        if (bg instanceof fabric.FabricImage) {
          const el = bg.getElement() as HTMLImageElement;
          naturalSizeRef.current = { w: el.naturalWidth, h: el.naturalHeight };
          handleResize();
        }
        canvas.renderAll();
        setCanUndo(historyCursorRef.current > 0);
        setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
        updateCanvasDirty();
      });
    }
  }, [updateCanvasDirty]); // eslint-disable-line react-hooks/exhaustive-deps — handleResize declared below, memoized, stable

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
  }, [saveHistory]);

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

      const initial = JSON.stringify(fabricCanvas.toJSON());
      historyRef.current = [initial];
      historyCursorRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setCanvasDirty(false);

      fabricCanvas.on('object:modified', () => saveHistory());
      fabricCanvas.on('object:added', () => { resetMarkerCounter(); updateCanvasDirty(); });
      fabricCanvas.on('object:removed', () => { resetMarkerCounter(); updateCanvasDirty(); });
    };
    img.src = dataUrl;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInstanceRef.current?.dispose();
      canvasInstanceRef.current = null;
    };
  }, [dataUrl, saveHistory, resetMarkerCounter, updateCanvasDirty, handleResize, showPanel]);

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
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const getPoint = (e: fabric.TPointerEventInfo): { x: number; y: number } => {
      const p = canvas.getScenePoint(e.e);
      return { x: p.x, y: p.y };
    };

    const isRectTool = activeTool === 'rect' || activeTool === 'rectFill';
    const fillMode = activeTool === 'rectFill';

    const handleMouseDown = (opt: fabric.TPointerEventInfo) => {
      if (activeTool === 'select' || activeTool === 'text' || activeTool === 'marker' || activeTool === 'crop' || cropMode) return;
      const { x, y } = getPoint(opt);
      isDrawingRef.current = true;
      startPointRef.current = { x, y };

      if (activeTool === 'arrow') {
        const line = new fabric.Line([x, y, x, y], {
          stroke: activeColor,
          strokeWidth,
          selectable: false,
          evented: false,
        });
        tempObjectRef.current = line;
        canvas.add(line);
      } else if (isRectTool) {
        const rect = new fabric.Rect({
          left: x,
          top: y,
          width: 0,
          height: 0,
          fill: fillMode ? activeColor : 'transparent',
          stroke: activeColor,
          strokeWidth,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
        });
        tempObjectRef.current = rect;
        canvas.add(rect);
      }
    };

    const handleMouseMove = (opt: fabric.TPointerEventInfo) => {
      if (!isDrawingRef.current || !startPointRef.current) return;
      const { x, y } = getPoint(opt);
      const { x: startX, y: startY } = startPointRef.current;

      if (activeTool === 'arrow' && tempObjectRef.current instanceof fabric.Line) {
        tempObjectRef.current.set({ x2: x, y2: y });
        canvas.renderAll();
      } else if (isRectTool && tempObjectRef.current instanceof fabric.Rect) {
        tempObjectRef.current.set({
          left: Math.min(startX, x),
          top: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        });
        canvas.renderAll();
      }
    };

    const handleMouseUp = (opt: fabric.TPointerEventInfo) => {
      if (!isDrawingRef.current || !startPointRef.current) return;
      const { x: endX, y: endY } = getPoint(opt);
      const { x: startX, y: startY } = startPointRef.current;
      isDrawingRef.current = false;
      startPointRef.current = null;

      if (activeTool === 'arrow') {
        if (tempObjectRef.current) { canvas.remove(tempObjectRef.current); tempObjectRef.current = null; }
        if (Math.hypot(endX - startX, endY - startY) < 5) return;
        const line = new fabric.Line([startX, startY, endX, endY], {
          stroke: activeColor, strokeWidth, selectable: true, evented: true,
        });
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowhead = new fabric.Triangle({
          left: endX, top: endY, width: 12, height: 12,
          angle: (angle * 180) / Math.PI + 90, fill: activeColor,
          selectable: false, evented: false, originX: 'center', originY: 'center',
        });
        canvas.add(new fabric.Group([line, arrowhead], { selectable: true, evented: true }));
        saveHistory();
      } else if (isRectTool) {
        if (tempObjectRef.current) { canvas.remove(tempObjectRef.current); tempObjectRef.current = null; }
        if (Math.hypot(endX - startX, endY - startY) < 5) return;
        canvas.add(new fabric.Rect({
          left: Math.min(startX, endX), top: Math.min(startY, endY),
          width: Math.abs(endX - startX), height: Math.abs(endY - startY),
          fill: fillMode ? activeColor : 'transparent',
          stroke: activeColor, strokeWidth,
          originX: 'left', originY: 'top',
          selectable: true, evented: true,
        }));
        saveHistory();
      }
    };

    const handleMouseDownForTextAndMarker = (opt: fabric.TPointerEventInfo) => {
      if (cropMode) return;
      const { x, y } = getPoint(opt);

      if (activeTool === 'text') {
        const text = new fabric.IText('Tekst', {
          left: x, top: y, fontSize: 16, fill: activeColor,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          originX: 'left', originY: 'top',
          selectable: true, editable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        saveHistory();
        return;
      }

      if (activeTool === 'marker') {
        const circle = new fabric.Circle({
          radius: 14, fill: activeColor,
          originX: 'center', originY: 'center', selectable: false, evented: false,
        });
        const label = new fabric.Text(String(markerCounter), {
          fontSize: 14, fill: '#ffffff', fontWeight: 'bold',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          originX: 'center', originY: 'center', selectable: false, evented: false,
        });
        const group = new fabric.Group([circle, label], {
          left: x, top: y, originX: 'center', originY: 'center', selectable: true, evented: true,
        });
        canvas.add(group);
        saveHistory();
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:down', handleMouseDownForTextAndMarker);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:down', handleMouseDownForTextAndMarker);
    };
  }, [activeTool, activeColor, strokeWidth, markerCounter, saveHistory, cropMode]);

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

  async function exportAnnotatedImage(): Promise<string> {
    const canvas = canvasInstanceRef.current;
    if (!canvas) throw new Error('No canvas');
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) throw new Error('No natural size');

    const scale = scaleRef.current;
    const invScale = 1 / scale;

    const tempCanvasEl = document.createElement('canvas');
    tempCanvasEl.width = naturalW;
    tempCanvasEl.height = naturalH;

    const tempFabric = new fabric.Canvas(tempCanvasEl, { width: naturalW, height: naturalH });

    const bgImg = canvas.backgroundImage;
    if (bgImg instanceof fabric.FabricImage) {
      const el = bgImg.getElement() as HTMLImageElement;
      const bgClone = new fabric.FabricImage(el, { scaleX: 1, scaleY: 1, originX: 'left', originY: 'top' });
      tempFabric.backgroundImage = bgClone;
    }

    const objects = canvas.getObjects();
    for (const obj of objects) {
      const cloned = await obj.clone();
      cloned.scaleX = (cloned.scaleX ?? 1) * invScale;
      cloned.scaleY = (cloned.scaleY ?? 1) * invScale;
      cloned.left = (cloned.left ?? 0) * invScale;
      cloned.top = (cloned.top ?? 0) * invScale;
      cloned.setCoords();
      tempFabric.add(cloned);
    }

    tempFabric.renderAll();
    const result = tempFabric.toDataURL({ multiplier: 1, format: 'jpeg', quality: 0.95 });
    tempFabric.dispose();
    return result;
  }

  const handleDone = () => {
    if (isSaving) return;
    setIsSaving(true);

    void (async () => {
      try {
        const result: SavedResult = buildSavedResult();
        if (result.imageDirty) {
          result.resultDataUrl = await exportAnnotatedImage();
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

  function getImageBounds(): { x: number; y: number; width: number; height: number } | null {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return null;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return null;
    const scale = scaleRef.current;
    const width = Math.round(naturalW * scale);
    const height = Math.round(naturalH * scale);
    const canvasEl = canvas.getElement();
    if (!canvasEl) return null;
    const container = containerRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    const x = canvasRect.left - containerRect.left;
    const y = canvasRect.top - containerRect.top;
    return { x, y, width, height };
  }

  function clampSelectionToImage(selection: CropRect): CropRect {
    const bounds = getImageBounds();
    if (!bounds) return selection;
    const x = Math.max(bounds.x, Math.min(selection.x, bounds.x + bounds.width - selection.width));
    const y = Math.max(bounds.y, Math.min(selection.y, bounds.y + bounds.height - selection.height));
    return { x, y, width: selection.width, height: selection.height };
  }

  function normalizeSelection(selection: CropRect): CropRect {
    const x = selection.width < 0 ? selection.x + selection.width : selection.x;
    const y = selection.height < 0 ? selection.y + selection.height : selection.y;
    return { x, y, width: Math.abs(selection.width), height: Math.abs(selection.height) };
  }

  function startCropMode() {
    setCropMode(true);
    setCropSelection(null);
    setActiveTool('crop');
  }

  function cancelCrop() {
    setCropMode(false);
    setCropSelection(null);
    setCropDragging(false);
    cropStartRef.current = null;
    setActiveTool('select');
  }

  function applyCrop() {
    const canvas = canvasInstanceRef.current;
    const container = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!canvas || !container || !canvasEl || !cropSelection) return;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return;

    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    const scale = scaleRef.current;
    const invScale = 1 / scale;

    let imgX = Math.round((cropSelection.x - offsetX) * invScale);
    let imgY = Math.round((cropSelection.y - offsetY) * invScale);
    let imgW = Math.round(cropSelection.width * invScale);
    let imgH = Math.round(cropSelection.height * invScale);

    imgX = Math.max(0, Math.min(imgX, naturalW - 1));
    imgY = Math.max(0, Math.min(imgY, naturalH - 1));
    imgW = Math.max(0, Math.min(imgW, naturalW - imgX));
    imgH = Math.max(0, Math.min(imgH, naturalH - imgY));

    if (imgW < 20 || imgH < 20) return;
    const crop = { x: imgX, y: imgY, width: imgW, height: imgH };

    const bgImg = canvas.backgroundImage;
    if (!(bgImg instanceof fabric.FabricImage)) return;
    const el = bgImg.getElement() as HTMLImageElement;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = crop.width;
    tempCanvas.height = crop.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(el, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const croppedDataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);

    const snapshotBefore = JSON.stringify(canvas.toJSON());

    const img = new Image();
    img.onload = () => {
      naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      const fabricImg = new fabric.FabricImage(img, {
        scaleX: scaleRef.current,
        scaleY: scaleRef.current,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });
      canvas.backgroundImage = fabricImg;
      handleResize();
      canvas.renderAll();

      setImageCropped(true);

      historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
      historyRef.current.push(snapshotBefore);
      historyRef.current.push(JSON.stringify(canvas.toJSON()));
      historyCursorRef.current += 2;
      setCanUndo(historyCursorRef.current > 0);
      setCanRedo(false);
      updateCanvasDirty();

      setCropMode(false);
      setCropSelection(null);
      setCropDragging(false);
      setActiveTool('select');
    };
    img.src = croppedDataUrl;
  }

  function handleCropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!cropMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cropStartRef.current = { x, y };
    setCropDragging(true);
    setCropSelection({
      x,
      y,
      width: 0,
      height: 0,
    });
  }

  function handleCropMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cropMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!cropDragging || !cropStartRef.current) return;

    const start = cropStartRef.current;
    const bounds = getImageBounds();
    if (!bounds) return;

    const nextX = Math.max(bounds.x, Math.min(Math.min(start.x, x), bounds.x + bounds.width - 20));
    const nextY = Math.max(bounds.y, Math.min(Math.min(start.y, y), bounds.y + bounds.height - 20));
    const maxW = bounds.x + bounds.width - nextX;
    const maxH = bounds.y + bounds.height - nextY;
    setCropSelection({
      x: nextX,
      y: nextY,
      width: Math.max(20, Math.min(Math.abs(x - start.x), maxW)),
      height: Math.max(20, Math.min(Math.abs(y - start.y), maxH)),
    });
  }

  function handleCropMouseUp() {
    if (!cropMode) return;
    setCropDragging(false);
    cropStartRef.current = null;

    setCropSelection((prev) => {
      if (!prev) return null;
      const normalized = normalizeSelection(prev);
      if (normalized.width < 20 || normalized.height < 20) return null;
      return clampSelectionToImage(normalized);
    });
  }

  const TOOL_ICONS: Partial<Record<Tool, JSX.Element>> = {
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

  const cropDisabled = canvasDirty;

  const mainContentHeight = cropMode
    ? `calc(100vh - ${TOOLBAR_HEIGHT + 32}px)`
    : `calc(100vh - ${TOOLBAR_HEIGHT}px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e', overflow: 'hidden' }}>
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
          <button onClick={deleteSelected} title="Delete" style={{ padding: '6px 10px', border: '1px solid var(--chrome-red)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-red)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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

      {cropMode && (
        <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#fff3cd', borderBottom: '1px solid #e6c200' }}>
          <span style={{ fontSize: 11, color: '#5c4a00' }}>Click and drag to draw a crop zone</span>
          <button
            onClick={applyCrop}
            disabled={!cropSelection || cropSelection.width < 20 || cropSelection.height < 20}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              border: 'none',
              borderRadius: 4,
              background: 'var(--chrome-blue)',
              color: '#fff',
              cursor: !cropSelection || cropSelection.width < 20 || cropSelection.height < 20 ? 'not-allowed' : 'pointer',
              opacity: !cropSelection || cropSelection.width < 20 || cropSelection.height < 20 ? 0.5 : 1,
            }}
          >
            Apply
          </button>
          <button
            onClick={cancelCrop}
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
          {cropMode && cropSelection && (
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
           >
             </div>
           )}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--chrome-bg)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 8,
              padding: 20,
              minWidth: 280,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--chrome-text-primary)', margin: '0 0 16px' }}>
              Discard changes? This can’t be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid var(--chrome-border)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--chrome-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Keep editing
              </button>
              <button
                onClick={() => { setShowConfirm(false); void onClose(); }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--chrome-red)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
