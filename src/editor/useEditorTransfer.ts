import type { PendingEditor, AnnotationResult } from '../types';
import { getLocal, setLocal } from '../lib/storage';

export function useEditorTransfer() {
  async function readPendingEditor(): Promise<PendingEditor | null> {
    return getLocal<PendingEditor>('pendingEditor');
  }

  async function writeAnnotationResult(result: AnnotationResult): Promise<void> {
    return setLocal('annotationResult', result);
  }

  async function cleanup(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['pendingEditor', 'annotationResult'], resolve);
    });
  }

  return { readPendingEditor, writeAnnotationResult, cleanup };
}
