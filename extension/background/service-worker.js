// Background service worker for Travel Together Chrome Extension.
//
// Spec: docs/extension/spec.md (Section 3)
//
// @implements REQ-EXT-002

/**
 * Listens for messages from popup and content scripts.
 *
 * - 'extract': injects content/extractor.js into the active tab.
 * - 'extractionResult': saves draft to chrome.storage.session and forwards to popup.
 *
 * @implements REQ-EXT-002, SCN-EXT-002-01
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content/extractor.js']
      });
    });
  }

  if (msg.action === 'extractionResult') {
    // Save to session storage for draft persistence
    chrome.storage.session.set({ draft: msg.data });
    // Forward to popup if open
    chrome.runtime.sendMessage({ action: 'extractionReady', data: msg.data });
  }
});
