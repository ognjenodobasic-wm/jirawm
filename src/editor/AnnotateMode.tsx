import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

interface AnnotateModeProps {
  dataUrl: string;
  thumbnailIndex: number;
  onDone: (resultDataUrl: string) => void;
  onCancel: () => void;
}

const TOOLBAR_HEIGHT = 56;

const COLORS = ['#ff4444', '#ffcc00', '#00cc88', '#4499ff', '#ffffff'];

type Tool = 'select' | 'arrow' | 'rect' | 'marker' | 'text';

export default function AnnotateMode({ dataUrl, onDone, onCancel }: AnnotateModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState<2 | 3 | 4>(2);
  const [rectFillMode, setRectFillMode] = useState(false);
  const [markerCounter, setMarkerCounter] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const historyRef = useRef<string[]>([]);
  const historyCursorRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const tempObjectRef = useRef<fabric.Object | null>(null);

  const saveHistory = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const snapshot = JSON.stringify(canvas.toJSON());
    // Remove any redo branches
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
      canvas.loadFromJSON(JSON.parse(snapshot), () => {
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
      canvas.loadFromJSON(JSON.parse(snapshot), () => {
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

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: true,
      preserveObjectStacking: true,
    });
    canvasInstanceRef.current = canvas;

    fabric.FabricImage.fromURL(dataUrl).then((img) => {
      const rawWidth = img.width ?? 800;
      const rawHeight = img.height ?? 600;
      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight - TOOLBAR_HEIGHT;
      const scale = Math.min(availableWidth / rawWidth, availableHeight / rawHeight, 1);

      canvas.setZoom(scale);
      canvas.setDimensions({ width: rawWidth * scale, height: rawHeight * scale });
      canvas.backgroundImage = img;
      canvas.requestRenderAll();

      // Initial history snapshot
      const initial = JSON.stringify(canvas.toJSON());
      historyRef.current = [initial];
      historyCursorRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    });

    const handleResize = () => {
      fabric.FabricImage.fromURL(dataUrl).then((img) => {
        const rawWidth = img.width ?? 800;
        const rawHeight = img.height ?? 600;
        const availableWidth = window.innerWidth;
        const availableHeight = window.innerHeight - TOOLBAR_HEIGHT;
        const scale = Math.min(availableWidth / rawWidth, availableHeight / rawHeight, 1);
        canvas.setZoom(scale);
        canvas.setDimensions({ width: rawWidth * scale, height: rawHeight * scale });
        canvas.backgroundImage = img;
        canvas.requestRenderAll();
      });
    };
    window.addEventListener('resize', handleResize);

    const handleObjectModified = () => saveHistory();
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:added', () => {
      resetMarkerCounter();
    });
    canvas.on('object:removed', () => {
      resetMarkerCounter();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('object:modified', handleObjectModified);
      canvas.dispose();
      canvasInstanceRef.current = null;
    };
  }, [dataUrl, saveHistory, resetMarkerCounter]);

  // Tool mode switching
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

  // Mouse drawing handlers
  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: fabric.TPointerEventInfo) => {
      if (activeTool === 'select' || activeTool === 'text') return;
      const pointer = canvas.getViewportPoint(opt.e);
      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };

      if (activeTool === 'rect') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
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
      const pointer = canvas.getViewportPoint(opt.e);
      const startX = startPointRef.current.x;
      const startY = startPointRef.current.y;

      if (activeTool === 'arrow' && tempObjectRef.current instanceof fabric.Line) {
        const line = tempObjectRef.current;
        line.set({ x2: pointer.x, y2: pointer.y });
        canvas.renderAll();
      } else if (activeTool === 'rect' && tempObjectRef.current instanceof fabric.Rect) {
        const rect = tempObjectRef.current;
        rect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY),
        });
        canvas.renderAll();
      }
    };

    const handleMouseUp = (opt: fabric.TPointerEventInfo) => {
      if (!isDrawingRef.current || !startPointRef.current) return;
      const pointer = canvas.getViewportPoint(opt.e);
      const startX = startPointRef.current.x;
      const startY = startPointRef.current.y;
      const endX = pointer.x;
      const endY = pointer.y;
      isDrawingRef.current = false;
      startPointRef.current = null;

      if (activeTool === 'arrow') {
        if (tempObjectRef.current) {
          canvas.remove(tempObjectRef.current);
          tempObjectRef.current = null;
        }
        if (Math.hypot(endX - startX, endY - startY) < 5) {
          canvas.renderAll();
          return;
        }
        const line = new fabric.Line([startX, startY, endX, endY], {
          stroke: activeColor,
          strokeWidth,
          selectable: true,
          evented: true,
        });
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowhead = new fabric.Triangle({
          left: endX,
          top: endY,
          width: 12,
          height: 12,
          angle: (angle * 180) / Math.PI + 90,
          fill: activeColor,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
        });
        const group = new fabric.Group([line, arrowhead], {
          selectable: true,
          evented: true,
        });
        canvas.add(group);
        saveHistory();
      } else if (activeTool === 'rect') {
        if (tempObjectRef.current) {
          canvas.remove(tempObjectRef.current);
          tempObjectRef.current = null;
        }
        if (Math.hypot(endX - startX, endY - startY) < 5) {
          canvas.renderAll();
          return;
        }
        const rect = new fabric.Rect({
          left: Math.min(startX, endX),
          top: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
          fill: rectFillMode ? activeColor : 'transparent',
          stroke: activeColor,
          strokeWidth,
          selectable: true,
          evented: true,
        });
        canvas.add(rect);
        saveHistory();
      }
    };

    const handleMouseDownCanvas = (opt: fabric.TPointerEventInfo) => {
      const pointer = canvas.getViewportPoint(opt.e);

      if (activeTool === 'text') {
        const text = new fabric.IText('Tekst', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 16,
          fill: activeColor,
          selectable: true,
          editable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        saveHistory();
        return;
      }

      if (activeTool === 'marker') {
        const x = pointer.x;
        const y = pointer.y;
        const circle = new fabric.Circle({
          radius: 14,
          fill: activeColor,
          left: x - 14,
          top: y - 14,
          selectable: true,
          evented: true,
          originX: 'left',
          originY: 'top',
        });
        const label = new fabric.Text(String(markerCounter), {
          fontSize: 14,
          fill: '#ffffff',
          fontWeight: 'bold',
          left: x,
          top: y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        const group = new fabric.Group([circle, label], {
          left: x - 14,
          top: y - 14,
          selectable: true,
          evented: true,
          originX: 'left',
          originY: 'top',
        });
        canvas.add(group);
        setMarkerCounter((prev) => prev + 1);
        saveHistory();
      }
    };

    // Arrow temporary line
    const wrappedMouseDown = (opt: fabric.TPointerEventInfo) => {
      if (activeTool === 'arrow') {
        const pointer = canvas.getViewportPoint(opt.e);
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: activeColor,
          strokeWidth,
          selectable: false,
          evented: false,
        });
        tempObjectRef.current = line;
        canvas.add(line);
      }
      handleMouseDown(opt);
    };

    canvas.on('mouse:down', wrappedMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:down', handleMouseDownCanvas);

    return () => {
      canvas.off('mouse:down', wrappedMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:down', handleMouseDownCanvas);
    };
  }, [activeTool, activeColor, strokeWidth, rectFillMode, markerCounter, saveHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'v')) {
        setActiveTool('select');
        return;
      }
      if (e.key.toLowerCase() === 'a') {
        setActiveTool('arrow');
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        setActiveTool('rect');
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        setActiveTool('marker');
        return;
      }
      if (e.key.toLowerCase() === 't') {
        setActiveTool('text');
        return;
      }
      if (e.key.toLowerCase() === 'f' && activeTool === 'rect') {
        setRectFillMode((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, undo, redo, deleteSelected]);

  const handleDone = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    requestAnimationFrame(() => {
      const result = canvas.toDataURL({ format: 'jpeg', quality: 0.9, multiplier: 1 });
      onDone(result);
    });
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
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {label}
        {tool === 'marker' && (
          <span
            style={{
              fontSize: '10px',
              background: 'rgba(255,255,255,0.2)',
              padding: '1px 4px',
              borderRadius: '8px',
            }}
          >
            M:{markerCounter}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#1a1a2e',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: TOOLBAR_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: 'var(--chrome-surface)',
          borderBottom: '1px solid var(--chrome-border)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toolButton('select', 'Select')}
          {toolButton('arrow', 'Arrow')}
          {toolButton('rect', 'Rect')}
          {toolButton('marker', 'Marker')}
          {toolButton('text', 'Text')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: color,
                border:
                  activeColor === color
                    ? '2px solid #fff'
                    : '1px solid var(--chrome-border)',
                cursor: 'pointer',
                boxShadow:
                  activeColor === color ? '0 0 0 1px var(--chrome-blue)' : 'none',
              }}
              aria-label={`Select color ${color}`}
            />
          ))}

          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value) as 2 | 3 | 4)}
            style={{
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid var(--chrome-border)',
              borderRadius: '4px',
              background: 'var(--chrome-bg)',
              color: 'var(--chrome-text-primary)',
            }}
          >
            <option value={2}>2px</option>
            <option value={3}>3px</option>
            <option value={4}>4px</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--chrome-border)',
              borderRadius: '4px',
              background: 'transparent',
              color: canUndo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--chrome-border)',
              borderRadius: '4px',
              background: 'transparent',
              color: canRedo ? 'var(--chrome-text-primary)' : 'var(--chrome-border)',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            Redo
          </button>
          <button
            onClick={deleteSelected}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--chrome-red)',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--chrome-red)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--chrome-border)',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--chrome-text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              background: 'var(--chrome-blue)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100vw',
          height: `calc(100vh - ${TOOLBAR_HEIGHT}px)`,
          overflow: 'hidden',
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
