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
  if (details.reason === 'install' || details.reason === 'update') {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    console.log('[SpeakIt] Extension installed/updated, defaults set.');
  }

  // Create Context Menu for PDFs and all pages
  chrome.contextMenus.create({
    id: 'speakit-read',
    title: '🔊 SpeakIt: Read this',
    contexts: ['selection']
  });
});

// Helper: Ensure Offscreen Document exists
async function setupOffscreenDocument() {
  const path = 'offscreen.html';
  const url = chrome.runtime.getURL(path);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url]
  });

  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Text-to-speech background playback for PDFs'
  });
}

// Handle Context Menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'speakit-read' && info.selectionText) {
    const settings = await chrome.storage.sync.get(null);
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    // First try sending to content script (if normal page)
    chrome.tabs.sendMessage(tab.id, { action: 'speak-selected', text: info.selectionText }, (response) => {
      // If error, it means no content script (e.g. PDF viewer)
      if (chrome.runtime.lastError) {
        console.log('[SpeakIt] Content script not found, using offscreen document for PDF...');
        setupOffscreenDocument().then(() => {
          chrome.runtime.sendMessage({
            action: 'offscreen-speak',
            text: info.selectionText,
            settings: mergedSettings
          });
        });
      }
    });
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;

  const settings = await chrome.storage.sync.get('enabled');
  if (settings.enabled === false) return;

  if (command === 'speak-selected') {
    // Note: 'speak-selected' via shortcut on PDFs is hard because we can't easily get 
    // the selected text from a PDF without content script. 
    // Context Menu is the only way to get text from a PDF.
    chrome.tabs.sendMessage(tab.id, { action: 'speak-selected' }).catch(() => {});
  } else if (command === 'stop-speaking') {
    chrome.tabs.sendMessage(tab.id, { action: 'stop-speaking' }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'offscreen-stop' }).catch(() => {});
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

  // Bangla TTS — fetch audio from Google Translate (background bypasses CORS)
  if (message.action === 'bangla-tts') {
    const { text, speed } = message;
    const params = new URLSearchParams({
      ie: 'UTF-8',
      tl: 'bn',
      client: 'tw-ob',
      q: text,
      ttsspeed: speed <= 0.7 ? '0.24' : '1'
    });
    const url = `https://translate.google.com/translate_tts?${params.toString()}`;

    fetch(url, { referrerPolicy: 'no-referrer' })
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.arrayBuffer();
      })
      .then(buffer => {
        // Convert to base64 data URI
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        sendResponse({ audio: `data:audio/mpeg;base64,${b64}` });
      })
      .catch(err => {
        console.error('[SpeakIt] Bangla TTS fetch error:', err);
        sendResponse({ error: err.message });
      });
    return true; // async
  }
});
