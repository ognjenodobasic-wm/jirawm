import { useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { Tool } from './useDrawingTools';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseCropToolParams {
  canvasInstanceRef: React.RefObject<fabric.Canvas | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  naturalSizeRef: React.RefObject<{ w: number; h: number }>;
  scaleRef: React.RefObject<number>;
  handleResize: () => void;
  commitHistoryPair: (beforeSnapshot: string) => void;
  setImageCropped: (value: boolean) => void;
  setActiveTool: (tool: Tool) => void;
}

function normalizeSelection(selection: CropRect): CropRect {
  const x = selection.width < 0 ? selection.x + selection.width : selection.x;
  const y = selection.height < 0 ? selection.y + selection.height : selection.y;
  return { x, y, width: Math.abs(selection.width), height: Math.abs(selection.height) };
}

export function useCropTool({
  canvasInstanceRef,
  containerRef,
  canvasRef,
  naturalSizeRef,
  scaleRef,
  handleResize,
  commitHistoryPair,
  setImageCropped,
  setActiveTool,
}: UseCropToolParams) {
  const [cropSelection, setCropSelection] = useState<CropRect | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

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
      commitHistoryPair(snapshotBefore);

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

  return {
    cropMode,
    cropSelection,
    startCropMode,
    cancelCrop,
    applyCrop,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp,
  };
}
