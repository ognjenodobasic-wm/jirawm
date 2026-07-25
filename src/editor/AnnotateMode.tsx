import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

interface AnnotateModeProps {
  dataUrl: string;
  thumbnailIndex: number;
  onDone: (resultDataUrl: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

const TOOLBAR_HEIGHT = 56;
const COLORS = ['#ff4444', '#ffcc00', '#00cc88', '#4499ff', '#ffffff'];
type Tool = 'select' | 'crop' | 'arrow' | 'rect' | 'rectFill' | 'marker' | 'text';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function AnnotateMode({ dataUrl, onDone, onCancel }: AnnotateModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const scaleRef = useRef<number>(1);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState<2 | 3 | 4>(2);
  const [markerCounter, setMarkerCounter] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
  const cropRectRef = useRef<HTMLDivElement | null>(null);

  const updateDirty = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    setIsDirty(canvas.getObjects().length > 0);
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
    updateDirty();
  }, [updateDirty]);

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
        updateDirty();
      });
    }
  }, [updateDirty]);

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
        updateDirty();
      });
    }
  }, [updateDirty]);

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
    const availW = window.innerWidth;
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
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvasEl = canvasRef.current;

    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      naturalSizeRef.current = { w: naturalW, h: naturalH };

      const availW = window.innerWidth;
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
      setIsDirty(false);

      fabricCanvas.on('object:modified', () => saveHistory());
      fabricCanvas.on('object:added', () => { resetMarkerCounter(); updateDirty(); });
      fabricCanvas.on('object:removed', () => { resetMarkerCounter(); updateDirty(); });
    };
    img.src = dataUrl;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInstanceRef.current?.dispose();
      canvasInstanceRef.current = null;
    };
  }, [dataUrl, saveHistory, resetMarkerCounter, updateDirty, handleResize]);

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
      if (cropMode) {
        if (e.key === 'Escape') { cancelCrop(); return; }
        return;
      }
      if (e.key === 'Escape') { handleExitRequest(); return; }
      if (e.key.toLowerCase() === 'v') { setActiveTool('select'); return; }
      if (e.key.toLowerCase() === 'c') { if (!isDirty) startCropMode(); return; }
      if (e.key.toLowerCase() === 'a') { setActiveTool('arrow'); return; }
      if (e.key.toLowerCase() === 'r') { setActiveTool('rect'); return; }
      if (e.key.toLowerCase() === 'm') { setActiveTool('marker'); return; }
      if (e.key.toLowerCase() === 't') { setActiveTool('text'); return; }
      if (e.key.toLowerCase() === 'f') { setActiveTool('rectFill'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); e.shiftKey ? redo() : undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, undo, redo, deleteSelected, cropMode, isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function handleExitRequest() {
    if (isDirty) setShowConfirm(true);
    else void onCancel();
  }

  const handleDone = () => {
    if (isSaving) return;
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return;
    setIsSaving(true);

    void (async () => {
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
      // Source image already went through JPEG compression at ingest. Re-exporting at the
      // same quality stacks artifacts, especially on screenshot text. Hardcode 0.95 here
      // so annotations and crops are always saved at maximum quality regardless of ingest quality.
      const result = tempFabric.toDataURL({ multiplier: 1, format: 'jpeg', quality: 0.95 });
      tempFabric.dispose();

      await onDone(result);
    })();
  };

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
    if (!canvas || !cropSelection) return;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return;

    const scale = scaleRef.current;
    const invScale = 1 / scale;
    const crop = {
      x: Math.max(0, Math.round(cropSelection.x * invScale)),
      y: Math.max(0, Math.round(cropSelection.y * invScale)),
      width: Math.min(naturalW - Math.round(cropSelection.x * invScale), Math.round(cropSelection.width * invScale)),
      height: Math.min(naturalH - Math.round(cropSelection.y * invScale), Math.round(cropSelection.height * invScale)),
    };

    if (crop.width < 20 || crop.height < 20) return;

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

    // Save current objects (none allowed during crop, but keep history shape)
    const snapshotBefore = JSON.stringify(canvas.toJSON());

    const img = new Image();
    img.onload = () => {
      naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      handleResize();
      const fabricImg = new fabric.FabricImage(img, {
        scaleX: scaleRef.current,
        scaleY: scaleRef.current,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });
      canvas.backgroundImage = fabricImg;
      canvas.clear();
      canvas.renderAll();

      historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
      historyRef.current.push(snapshotBefore);
      historyRef.current.push(JSON.stringify(canvas.toJSON()));
      historyCursorRef.current += 2;
      setCanUndo(historyCursorRef.current > 0);
      setCanRedo(false);
      updateDirty();

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
    setCropSelection({ x, y, width: 0, height: 0 });
  }

  function handleCropMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cropMode || !cropDragging || !cropStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startX = cropStartRef.current.x;
    const startY = cropStartRef.current.y;
    setCropSelection({
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      width: Math.abs(x - startX),
      height: Math.abs(y - startY),
    });
  }

  function handleCropMouseUp() {
    if (!cropMode) return;
    setCropDragging(false);
    cropStartRef.current = null;
  }

  const toolButton = (tool: Tool, label: string, disabled = false, title?: string) => {
    const isActive = activeTool === tool;
    return (
      <button
        key={tool}
        onClick={() => { if (!disabled) setActiveTool(tool); }}
        title={title}
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
        {label}
        {tool === 'marker' && (
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '8px' }}>
            M:{markerCounter}
          </span>
        )}
      </button>
    );
  };

  const cropDisabled = isDirty;

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
          {toolButton('marker', 'Marker')}
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
          <button onClick={undo} disabled={!canUndo} style={{ padding: '6px 10px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: canUndo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: '12px' }}>Undo</button>
          <button onClick={redo} disabled={!canRedo} style={{ padding: '6px 10px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: canRedo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)', cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: '12px' }}>Redo</button>
          <button onClick={deleteSelected} style={{ padding: '6px 10px', border: '1px solid var(--chrome-red)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-red)', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
          {isDirty ? (
            <>
              <button onClick={handleExitRequest} style={{ padding: '6px 14px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-text-primary)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleDone} disabled={isSaving} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', background: isSaving ? 'var(--chrome-border)' : 'var(--chrome-blue)', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 500, opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={handleExitRequest} style={{ padding: '6px 14px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-text-primary)', cursor: 'pointer', fontSize: '12px' }}>Close</button>
          )}
        </div>
      </div>

      {cropMode && (
        <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--chrome-surface)', borderBottom: '1px solid var(--chrome-border)' }}>
          <span style={{ fontSize: 11, color: 'var(--chrome-text-secondary)' }}>Drag to select a region</span>
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

      <div
        ref={containerRef}
        onMouseDown={handleCropMouseDown}
        onMouseMove={handleCropMouseMove}
        onMouseUp={handleCropMouseUp}
        onMouseLeave={handleCropMouseUp}
        style={{
          flex: 1,
          width: '100vw',
          height: `calc(100vh - ${TOOLBAR_HEIGHT}px)`,
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
            ref={cropRectRef}
            style={{
              position: 'absolute',
              left: cropSelection.x,
              top: cropSelection.y,
              width: cropSelection.width,
              height: cropSelection.height,
              border: '1px solid #ffffff',
              background: 'rgba(0,0,0,0.55)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', bottom: -4, left: -4, width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
            <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.4)' }} />
          </div>
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
              Discard annotations? This can’t be undone.
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
                onClick={() => { setShowConfirm(false); void onCancel(); }}
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
