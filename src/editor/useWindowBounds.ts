import { useEffect, useRef } from 'react';
import type { WindowBounds } from '../types';

const STORAGE_KEY = 'editorWindowBounds';

export function useWindowBounds() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let listener: ((win: chrome.windows.Window) => void) | null = null;

    chrome.windows.getCurrent((currentWindow) => {
      const windowId = currentWindow.id;

      listener = (win: chrome.windows.Window) => {
        if (win.id !== windowId) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const bounds: WindowBounds = {
            width: win.width ?? 1000,
            height: win.height ?? 700,
            left: win.left ?? 0,
            top: win.top ?? 0,
          };
          chrome.storage.local.set({ [STORAGE_KEY]: bounds });
        }, 500);
      };

      chrome.windows.onBoundsChanged.addListener(listener);
    });

    return () => {
      if (listener) chrome.windows.onBoundsChanged.removeListener(listener);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function readBounds(): Promise<WindowBounds | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        resolve((result[STORAGE_KEY] as WindowBounds) ?? null);
      });
    });
  }

  function saveBounds(win: chrome.windows.Window): void {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const bounds: WindowBounds = {
        width: win.width ?? 1000,
        height: win.height ?? 700,
        left: win.left ?? 0,
        top: win.top ?? 0,
      };
      chrome.storage.local.set({ [STORAGE_KEY]: bounds });
    }, 500);
  }

  return { readBounds, saveBounds };
}
