// Crawlers Extension — background service worker
// Opens the side panel on action click.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn('[Crawlers] sidePanel setup error', e));
});

// Allow side panel to be opened from popup messaging
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'OPEN_SIDE_PANEL' && sender.tab?.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
  return false;
});
