chrome.runtime.onInstalled.addListener(() => {
  console.log('JiraWM installed.');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-jirawm') {
    chrome.sidePanel.open({ windowId: undefined as unknown as number }).catch(console.error);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId == null) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});
