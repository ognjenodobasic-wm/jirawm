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
type Tool = 'select' | 'arrow' | 'rect' | 'marker' | 'text';

export default function AnnotateMode({ dataUrl, onDone, onCancel }: AnnotateModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const scaleRef = useRef<number>(1);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState<2 | 3 | 4>(2);
  const [rectFillMode, setRectFillMode] = useState(false);
  const [markerCounter, setMarkerCounter] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const historyRef = useRef<string[]>([]);
  const historyCursorRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const tempObjectRef = useRef<fabric.Object | null>(null);

  const saveHistory = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const snapshot = JSON.stringify(canvas.toJSON());
    historyRef.current = historyRef.current.slice(0, historyCursorRef.current + 1);
    historyRef.current.push(snapshot);
    historyCursorRef.current++;
    setCanUndo(historyCursorRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || historyCursorRef.current <= 0) return;
    historyCursorRef.current--;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) {
      canvas.loadFromJSON(JSON.parse(snapshot)).then(() => {
        canvas.renderAll();
        setCanUndo(historyCursorRef.current > 0);
        setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
      });
    }
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || historyCursorRef.current >= historyRef.current.length - 1) return;
    historyCursorRef.current++;
    const snapshot = historyRef.current[historyCursorRef.current];
    if (snapshot) {
      canvas.loadFromJSON(JSON.parse(snapshot)).then(() => {
        canvas.renderAll();
        setCanUndo(historyCursorRef.current > 0);
        setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
      });
    }
  }, []);

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
      });
      fabricCanvas.backgroundImage = fabricImg;
      fabricCanvas.renderAll();

      const initial = JSON.stringify(fabricCanvas.toJSON());
      historyRef.current = [initial];
      historyCursorRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);

      fabricCanvas.on('object:modified', () => saveHistory());
      fabricCanvas.on('object:added', () => resetMarkerCounter());
      fabricCanvas.on('object:removed', () => resetMarkerCounter());
    };
    img.src = dataUrl;

    const handleResize = () => {
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
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInstanceRef.current?.dispose();
      canvasInstanceRef.current = null;
    };
  }, [dataUrl, saveHistory, resetMarkerCounter]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;
    canvas.selection = activeTool === 'select';
    canvas.forEachObject((obj) => {
      obj.selectable = activeTool === 'select';
      obj.evented = activeTool === 'select';
    });
    canvas.discardActiveObject();
    canvas.renderAll();
  }, [activeTool]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const getPoint = (e: fabric.TPointerEventInfo): { x: number; y: number } => {
      const p = canvas.getScenePoint(e.e);
      return { x: p.x, y: p.y };
    };

    const handleMouseDown = (opt: fabric.TPointerEventInfo) => {
      if (activeTool === 'select' || activeTool === 'text' || activeTool === 'marker') return;
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
      } else if (activeTool === 'rect') {
        const rect = new fabric.Rect({
          left: x,
          top: y,
          width: 0,
          height: 0,
          fill: rectFillMode ? activeColor : 'transparent',
          stroke: activeColor,
          strokeWidth,
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
      } else if (activeTool === 'rect' && tempObjectRef.current instanceof fabric.Rect) {
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
      } else if (activeTool === 'rect') {
        if (tempObjectRef.current) { canvas.remove(tempObjectRef.current); tempObjectRef.current = null; }
        if (Math.hypot(endX - startX, endY - startY) < 5) return;
        canvas.add(new fabric.Rect({
          left: Math.min(startX, endX), top: Math.min(startY, endY),
          width: Math.abs(endX - startX), height: Math.abs(endY - startY),
          fill: rectFillMode ? activeColor : 'transparent',
          stroke: activeColor, strokeWidth, selectable: true, evented: true,
        }));
        saveHistory();
      }
    };

    const handleMouseDownForTextAndMarker = (opt: fabric.TPointerEventInfo) => {
      const { x, y } = getPoint(opt);

      if (activeTool === 'text') {
        const text = new fabric.IText('Tekst', {
          left: x, top: y, fontSize: 16, fill: activeColor, selectable: true, editable: true,
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
        setMarkerCounter((prev) => prev + 1);
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
  }, [activeTool, activeColor, strokeWidth, rectFillMode, markerCounter, saveHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'v') { setActiveTool('select'); return; }
      if (e.key.toLowerCase() === 'a') { setActiveTool('arrow'); return; }
      if (e.key.toLowerCase() === 'r') { setActiveTool('rect'); return; }
      if (e.key.toLowerCase() === 'm') { setActiveTool('marker'); return; }
      if (e.key.toLowerCase() === 't') { setActiveTool('text'); return; }
      if (e.key.toLowerCase() === 'f' && activeTool === 'rect') { setRectFillMode((p) => !p); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); e.shiftKey ? redo() : undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, undo, redo, deleteSelected]);

  const handleDone = () => {
    if (isDone) return;
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const { w: naturalW, h: naturalH } = naturalSizeRef.current;
    if (!naturalW || !naturalH) return;
    setIsDone(true);

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
      const result = tempFabric.toDataURL({ multiplier: 1, format: 'jpeg', quality: 0.9 });
      tempFabric.dispose();

      await onDone(result);
    })();
  };

  const toolButton = (tool: Tool, label: string) => {
    const isActive = activeTool === tool;
    return (
      <button
        key={tool}
        onClick={() => setActiveTool(tool)}
        style={{
          padding: '6px 12px',
          border: `1px solid ${isActive ? 'var(--chrome-blue)' : 'var(--chrome-border)'}`,
          borderRadius: '4px',
          background: isActive ? 'var(--chrome-blue)' : 'transparent',
          color: isActive ? '#fff' : 'var(--chrome-text-primary)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        {label}
        {tool === 'marker' && (
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '8px' }}>
            M:{markerCounter}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e', overflow: 'hidden' }}>
      <div style={{ height: TOOLBAR_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--chrome-surface)', borderBottom: '1px solid var(--chrome-border)', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toolButton('select', 'Select')}
          {toolButton('arrow', 'Arrow')}
          {toolButton('rect', 'Rect')}
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
          <button onClick={onCancel} style={{ padding: '6px 12px', border: '1px solid var(--chrome-border)', borderRadius: '4px', background: 'transparent', color: 'var(--chrome-text-primary)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          <button onClick={handleDone} disabled={isDone} style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', background: isDone ? 'var(--chrome-border)' : 'var(--chrome-blue)', color: isDone ? 'var(--chrome-text-secondary)' : '#fff', cursor: isDone ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 500, opacity: isDone ? 0.7 : 1 }}>
            {isDone ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, width: '100vw', height: `calc(100vh - ${TOOLBAR_HEIGHT}px)`, overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
