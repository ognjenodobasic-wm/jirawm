import type { ImageSettings } from '../types';

function loadSource(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}

export async function normalizeImage(
  source: string | File | Blob,
  settings: ImageSettings,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadSource(source);
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  const scale = Math.min(1, settings.maxWidth / naturalWidth);
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  ctx.fillStyle = settings.transparencyFill === 'black' ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', settings.quality);

  return { dataUrl, width, height };
}

export async function readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadSource(dataUrl);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export function toJpegFilename(original: string): string {
  const lastDot = original.lastIndexOf('.');
  const basename = lastDot > 0 ? original.slice(0, lastDot) : original;
  const ext = '.jpg';

  const sanitized = basename.replace(/[\\/:*?"<>|]/g, '-');
  const truncated = sanitized.slice(0, 80);
  return truncated + ext;
}
