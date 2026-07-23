declare namespace chrome.tabs {
  export function captureVisibleTab(
    windowId: null,
    options: chrome.tabs.ImageDetails,
  ): Promise<string>;
}
