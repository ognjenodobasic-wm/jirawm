import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';

export type Tool = 'select' | 'crop' | 'arrow' | 'rect' | 'rectFill' | 'marker' | 'text';

interface UseDrawingToolsParams {
  canvasInstanceRef: React.RefObject<fabric.Canvas | null>;
  activeTool: Tool;
  activeColor: string;
  strokeWidth: number;
  markerCounter: number;
  saveHistory: () => void;
  cropMode: boolean;
  canvasReady: boolean;
}

export function useDrawingTools({
  canvasInstanceRef,
  activeTool,
  activeColor,
  strokeWidth,
  markerCounter,
  saveHistory,
  cropMode,
  canvasReady,
}: UseDrawingToolsParams) {
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const tempObjectRef = useRef<fabric.Object | null>(null);

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
  }, [canvasInstanceRef, activeTool, activeColor, strokeWidth, markerCounter, saveHistory, cropMode, canvasReady]);
}
