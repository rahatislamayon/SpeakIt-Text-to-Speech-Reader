/**
 * SpeakIt — Background Service Worker
 * Manages extension lifecycle, settings storage, and keyboard commands.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  voice: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  buttonPosition: 'top-right',
  autoPlay: false,
  highlightEnabled: false,
  highlightColor: '#ffff00'
};

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    console.log('[SpeakIt] Extension installed, defaults set.');
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;

  const settings = await chrome.storage.sync.get('enabled');
  if (settings.enabled === false) return;

  if (command === 'speak-selected') {
    chrome.tabs.sendMessage(tab.id, { action: 'speak-selected' }).catch(() => {});
  } else if (command === 'stop-speaking') {
    chrome.tabs.sendMessage(tab.id, { action: 'stop-speaking' }).catch(() => {});
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get-settings') {
    chrome.storage.sync.get(null, (settings) => {
      // Merge with defaults for any missing keys
      sendResponse({ ...DEFAULT_SETTINGS, ...settings });
    });
    return true; // async
  }

  if (message.action === 'save-settings') {
    chrome.storage.sync.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'reset-settings') {
    chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
      sendResponse({ settings: DEFAULT_SETTINGS });
    });
    return true;
  }
});
