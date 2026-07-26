import { useEffect, useRef, useState } from 'react';
import type { AppSettings, ScreenshotItem, Workflow } from '../../types';
import { normalizeImage, readImageSize, toJpegFilename } from '../../lib/image';
import { collectCaptureMetadata } from '../../lib/capture-metadata';
import { hasCapturePermission, requestCapturePermission } from '../../lib/permissions';
import { MAX_SCREENSHOTS, buildImageSettings } from './types';

interface UseScreenshotCaptureArgs {
  screenshots: ScreenshotItem[];
  setScreenshots: (next: ScreenshotItem[] | ((prev: ScreenshotItem[]) => ScreenshotItem[])) => void;
  setSelectedId: (next: string | null) => void;
  setResultKey: (next: string | null) => void;
  setAttachFailed: (next: boolean) => void;
  setError: (next: string | null) => void;
  activeWorkflow: Workflow | null;
  appSettings: AppSettings | null;
}

export function useScreenshotCapture({
  screenshots,
  setScreenshots,
  setSelectedId,
  setResultKey,
  setAttachFailed,
  setError,
  activeWorkflow,
  appSettings,
}: UseScreenshotCaptureArgs) {
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [capturePermission, setCapturePermission] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(1);

  const naming = appSettings?.naming ?? { numberSingleScreenshots: true, numberBulkFiles: true };

  useEffect(() => {
    hasCapturePermission().then(setCapturePermission).catch(() => setCapturePermission(false));
  }, []);

  // Re-check permission when the panel becomes visible again.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        hasCapturePermission().then(setCapturePermission).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  async function handleCapture() {
    if (screenshots.length >= MAX_SCREENSHOTS) return;
    setPermissionMessage(null);

    // Request permission synchronously from the click. Calling request when already granted
    // resolves true immediately without showing a prompt. This must be the first awaited call
    // after the click so Chrome accepts it.
    if (capturePermission !== true) {
      const granted = await requestCapturePermission();
      setCapturePermission(granted);
      if (!granted) {
        setPermissionMessage(
          'Screenshot capture needs permission to read the current page. Use Add to upload an image instead, or click Capture again to grant it.',
        );
        return;
      }
    }

    try {
      setError(null);
      const settings = appSettings;
      const imageSettings = buildImageSettings(settings, activeWorkflow);
      const tab = await chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] ?? null);
      const tabId = tab?.id ?? -1;

      // Capture lossless PNG so normalizeImage performs the only JPEG compression step.
      const rawDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      const { width: rawWidth, height: rawHeight } = await readImageSize(rawDataUrl);

      const metadata =
        tabId >= 0 && settings
          ? await collectCaptureMetadata(tabId, rawWidth, rawHeight, settings.captureDetails)
          : null;

      const { dataUrl } = await normalizeImage(rawDataUrl, imageSettings);

      const number = naming.numberSingleScreenshots ? counterRef.current++ : null;
      const filename = number !== null ? `${number}.jpg` : toJpegFilename('screenshot.jpg');

      const item: ScreenshotItem = {
        id: crypto.randomUUID(),
        dataUrl,
        origin: 'capture',
        number,
        filename,
        metadata,
        metadataOverrides: null,
      };
      setScreenshots((prev) => [...prev, item]);
      setSelectedId(item.id);
      setResultKey(null);
      setAttachFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) return;
    const accepted = imageFiles.slice(0, remaining);
    const skipped = imageFiles.length - accepted.length;
    const imageSettings = buildImageSettings(appSettings, activeWorkflow);

    for (const file of accepted) {
      try {
        const { dataUrl } = await normalizeImage(file, imageSettings);
        const number = naming.numberSingleScreenshots ? counterRef.current++ : null;
        const filename = number !== null ? `${number}.jpg` : toJpegFilename(file.name);
        const item: ScreenshotItem = {
          id: crypto.randomUUID(),
          dataUrl,
          origin: 'upload',
          number,
          filename,
          metadata: null,
          metadataOverrides: null,
        };
        setScreenshots((prev) => [...prev, item]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    if (skipped > 0) {
      setError(`Only ${MAX_SCREENSHOTS} screenshots per task — ${skipped} file${skipped === 1 ? '' : 's'} were skipped.`);
    }
    setResultKey(null);
    setAttachFailed(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleRemove(id: string) {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  }

  function resetCounter() {
    counterRef.current = 1;
  }

  return {
    fileInputRef,
    capturePermission,
    permissionMessage,
    handleCapture,
    handleFiles,
    handleFileSelect,
    handleRemove,
    resetCounter,
  };
}
