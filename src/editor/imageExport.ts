import * as fabric from 'fabric';

export async function exportAnnotatedImage(
  canvas: fabric.Canvas,
  naturalSize: { w: number; h: number },
  scale: number,
): Promise<string> {
  const { w: naturalW, h: naturalH } = naturalSize;
  if (!naturalW || !naturalH) throw new Error('No natural size');

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
