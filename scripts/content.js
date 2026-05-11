/**
 * SpeakIt — Content Script
 * Detects text selection, shows speak button, drives Web Speech API playback.
 */
(() => {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────
  const MAX_TEXT_LENGTH = 10000;
  const BTN_OFFSET = 10;
  const DEBOUNCE_MS = 80;
  const BANGLA_TTS_CHUNK_SIZE = 200; // Google Translate TTS character limit per request

  // SVG icon paths
  const ICONS = {
    speak: `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    resume: `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    stop: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
    loading: `<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`
  };

  // ─── State ──────────────────────────────────────────────────
  let settings = { enabled: true, voice: '', rate: 1, pitch: 1, volume: 1, buttonPosition: 'top-right' };
  let speakBtn = null;
  let tooltip = null;
  let currentUtterance = null;
  let isPlaying = false;
  let isPaused = false;
  let selectionTimeout = null;
  let banglaAudio = null;  // Audio element for Bangla TTS
  let isBanglaMode = false; // Track which engine is active

  // ─── Init ───────────────────────────────────────────────────
  loadSettings().then(() => {
    if (settings.enabled === false) return;
    createButton();
    attachListeners();
  });

  // Listen for setting changes
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    if (changes.enabled) {
      if (settings.enabled) {
        if (!speakBtn) { createButton(); attachListeners(); }
      } else {
        stopSpeaking();
        hideButton();
      }
    }
  });

  // Listen for commands from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'speak-selected') {
      speakSelected(message.text);
    } else if (message.action === 'stop-speaking') {
      stopSpeaking();
    }
  });

  // ─── Settings ───────────────────────────────────────────────
  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(null);
      settings = { ...settings, ...stored };
    } catch (e) {
      console.warn('[SpeakIt] Failed to load settings', e);
    }
  }

  // ─── DOM: Button & Tooltip ──────────────────────────────────
  function createButton() {
    if (speakBtn) return;

    speakBtn = document.createElement('button');
    speakBtn.id = 'speakit-btn';
    speakBtn.setAttribute('aria-label', 'Speak selected text');
    speakBtn.setAttribute('role', 'button');
    speakBtn.setAttribute('tabindex', '0');
    speakBtn.innerHTML = ICONS.speak;
    document.documentElement.appendChild(speakBtn);

    tooltip = document.createElement('div');
    tooltip.id = 'speakit-tooltip';
    tooltip.textContent = 'Speak';
    document.documentElement.appendChild(tooltip);

    // Events
    speakBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent text selection from clearing
    });
    speakBtn.addEventListener('click', onButtonClick, true);
    speakBtn.addEventListener('mouseenter', showTooltip);
    speakBtn.addEventListener('mouseleave', hideTooltip);
    speakBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onButtonClick(); }
    });
  }

  function attachListeners() {
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('keyup', onSelectionChange);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('scroll', onScroll, true);
  }

  function onScroll() {
    // Don't hide the button while speech is playing — reposition it instead
    if (isPlaying || isPaused) {
      positionButton();
    } else {
      hideButton();
    }
  }

  // ─── Selection Handling ─────────────────────────────────────
  function onSelectionChange(e) {
    if (!settings.enabled) return;
    // Ignore clicks on the button itself
    if (speakBtn && speakBtn.contains(e.target)) return;

    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      const text = getSelectedText();
      if (text.length > 0) {
        positionButton();
      } else if (!isPlaying) {
        hideButton();
      }
    }, DEBOUNCE_MS);
  }

  function onMouseDown(e) {
    if (!settings.enabled) return;
    if (speakBtn && speakBtn.contains(e.target)) return;
    if (tooltip && tooltip.contains(e.target)) return;
    // Don't hide if currently playing – user might want pause/stop
    if (!isPlaying) hideButton();
  }

  function getSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return '';
    const text = sel.toString().trim();
    return text;
  }

  function cleanText(raw) {
    let t = raw.replace(/\s+/g, ' ').trim();
    if (t.length > MAX_TEXT_LENGTH) t = t.substring(0, MAX_TEXT_LENGTH);
    return t;
  }

  // ─── Button Positioning ─────────────────────────────────────
  function positionButton() {
    if (!speakBtn) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    let top, left;
    const pos = settings.buttonPosition || 'top-right';
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    switch (pos) {
      case 'top-left':
        top = rect.top + scrollY - 40 - BTN_OFFSET;
        left = rect.left + scrollX;
        break;
      case 'bottom-right':
        top = rect.bottom + scrollY + BTN_OFFSET;
        left = rect.right + scrollX - 40;
        break;
      case 'bottom-left':
        top = rect.bottom + scrollY + BTN_OFFSET;
        left = rect.left + scrollX;
        break;
      case 'top-right':
      default:
        top = rect.top + scrollY - 40 - BTN_OFFSET;
        left = rect.right + scrollX - 40;
        break;
    }

    // Clamp to viewport
    const vw = document.documentElement.clientWidth;
    if (left < 4) left = 4;
    if (left + 40 > vw + scrollX) left = vw + scrollX - 44;
    if (top < scrollY + 4) top = scrollY + 4;

    speakBtn.style.top = `${top}px`;
    speakBtn.style.left = `${left}px`;
    speakBtn.classList.add('speakit-visible');
  }

  function hideButton() {
    if (!speakBtn) return;
    speakBtn.classList.remove('speakit-visible');
    hideTooltip();
  }

  // ─── Tooltip ────────────────────────────────────────────────
  function showTooltip() {
    if (!tooltip || !speakBtn) return;
    const rect = speakBtn.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.transform = 'translateX(-50%)';

    if (isPlaying && !isPaused) tooltip.textContent = 'Pause';
    else if (isPaused) tooltip.textContent = 'Resume';
    else tooltip.textContent = 'Speak';

    tooltip.classList.add('speakit-tooltip-visible');
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('speakit-tooltip-visible');
  }

  // ─── Toast Notifications ───────────────────────────────────
  function showToast(message, type = 'info', duration = 2500) {
    let toast = document.getElementById('speakit-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'speakit-toast';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = '';
    toast.classList.add('speakit-toast-visible', type === 'error' ? 'speakit-toast-error' : 'speakit-toast-info');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('speakit-toast-visible');
    }, duration);
  }

  // ─── Speech: Core ───────────────────────────────────────────
  function onButtonClick() {
    if (isPaused) {
      resumeSpeaking();
    } else if (isPlaying) {
      pauseSpeaking();
    } else {
      speakSelected();
    }
  }

  // ─── Bangla TTS (Direct Google Translate — no server needed) ─
  function isBanglaVoice(voiceName) {
    return voiceName && voiceName.startsWith('bangla-');
  }

  /** Split text into chunks at sentence boundaries, respecting the character limit */
  function chunkText(text, maxLen) {
    const chunks = [];
    // Split on sentence-ending punctuation (।, ., !, ?)
    const sentences = text.match(/[^।\.!?]+[।\.!?]*/g) || [text];
    let current = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length > maxLen) {
        // Long sentence — split on commas/spaces
        if (current) { chunks.push(current.trim()); current = ''; }
        const words = trimmed.split(/\s+/);
        let wordBuf = '';
        for (const word of words) {
          if ((wordBuf + ' ' + word).trim().length > maxLen) {
            if (wordBuf) chunks.push(wordBuf.trim());
            wordBuf = word;
          } else {
            wordBuf = wordBuf ? wordBuf + ' ' + word : word;
          }
        }
        if (wordBuf) chunks.push(wordBuf.trim());
      } else if ((current + ' ' + trimmed).trim().length > maxLen) {
        chunks.push(current.trim());
        current = trimmed;
      } else {
        current = current ? current + ' ' + trimmed : trimmed;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text.slice(0, maxLen)];
  }

  let banglaChunks = [];
  let banglaAudioElements = [];
  let banglaChunkIdx = 0;
  let banglaSessionId = 0; // Prevent race conditions on rapid clicks

  function speakBangla(text) {
    updateButtonState('loading');
    isBanglaMode = true;
    const currentSessionId = ++banglaSessionId;

    // Stop any previous playback
    if (banglaAudio) {
      banglaAudio.pause();
      banglaAudio = null;
    }
    
    banglaChunks = chunkText(text, BANGLA_TTS_CHUNK_SIZE);
    banglaAudioElements = new Array(banglaChunks.length).fill(null);
    banglaChunkIdx = 0;

    // Pre-fetch chunks sequentially to avoid gaps and autoplay blocks
    prefetchChunk(0, currentSessionId, () => {
      // Once the first chunk is ready, start playing immediately
      playNextBanglaChunk();
    });
  }

  function prefetchChunk(index, sessionId, onFirstReady) {
    if (index >= banglaChunks.length || !isBanglaMode || sessionId !== banglaSessionId) return;

    chrome.runtime.sendMessage(
      { action: 'bangla-tts', text: banglaChunks[index], speed: settings.rate },
      (response) => {
        if (!isBanglaMode || sessionId !== banglaSessionId) return; // aborted or superseded

        if (chrome.runtime.lastError) {
          console.error('[SpeakIt] sendMessage error:', chrome.runtime.lastError.message);
          handleChunkError(index, 'Extension reloaded. Please refresh the page!');
          return;
        }

        if (!response || response.error) {
          console.error('[SpeakIt] Bangla TTS error:', response?.error);
          handleChunkError(index, `Bangla TTS failed: ${response?.error || 'Unknown'}`);
          return;
        }

        // Create the audio element for this chunk
        const audioEl = new Audio(response.audio);
        audioEl.volume = settings.volume;

        audioEl.onplay = () => {
          isPlaying = true;
          isPaused = false;
          updateButtonState('playing');
        };

        audioEl.onended = () => {
          banglaChunkIdx++;
          playNextBanglaChunk(); // Play next seamlessly
        };

        audioEl.onerror = () => {
          console.error('[SpeakIt] Chunk audio playback error at index', index);
          handleChunkError(index, 'Audio chunk playback error');
        };

        // Store it in the array
        banglaAudioElements[index] = audioEl;

        // If this was the first chunk, trigger playback
        if (index === 0 && onFirstReady) {
          onFirstReady();
        }

        // Immediately start fetching the next chunk in the background
        prefetchChunk(index + 1, sessionId);
      }
    );
  }

  function handleChunkError(index, msg) {
    if (index === 0) {
      isPlaying = false;
      isBanglaMode = false;
      banglaAudio = null;
      updateButtonState('error');
      showToast(msg, 'error');
      setTimeout(() => updateButtonState('idle'), 3000);
    } else {
      // If a later chunk fails, we might just stop when we reach it
      banglaAudioElements[index] = { error: msg };
    }
  }

  function playNextBanglaChunk() {
    if (banglaChunkIdx >= banglaChunks.length) {
      // All chunks finished
      isPlaying = false;
      isPaused = false;
      isBanglaMode = false;
      banglaAudio = null;
      banglaAudioElements = []; // free memory
      updateButtonState('idle');
      setTimeout(() => { if (!isPlaying) hideButton(); }, 800);
      return;
    }

    const audioEl = banglaAudioElements[banglaChunkIdx];
    
    if (!audioEl) {
      // Chunk hasn't finished downloading yet, wait a bit
      updateButtonState('loading');
      setTimeout(playNextBanglaChunk, 200);
      return;
    }

    if (audioEl.error) {
      // Encountered a fetch error on this chunk
      isPlaying = false;
      isBanglaMode = false;
      banglaAudio = null;
      updateButtonState('error');
      showToast(audioEl.error, 'error');
      setTimeout(() => updateButtonState('idle'), 3000);
      return;
    }

    banglaAudio = audioEl;
    banglaAudio.play().catch(e => {
      console.error('[SpeakIt] Play error:', e);
      isPlaying = false;
      isBanglaMode = false;
      updateButtonState('error');
      showToast(`Play error: ${e.message}`, 'error');
      setTimeout(() => updateButtonState('idle'), 3000);
    });
  }

  // ─── Main Speak Function ────────────────────────────────────
  function speakSelected(textOverride) {
    const text = textOverride || cleanText(getSelectedText());
    if (!text) {
      showToast('Select some text first', 'info');
      return;
    }

    // Route to Google Translate TTS if a Bangla voice is selected
    if (isBanglaVoice(settings.voice)) {
      speakBangla(text);
      return;
    }

    // Check API availability
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported in this browser', 'error');
      return;
    }

    // Stop any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply settings
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    // Find voice
    const voices = speechSynthesis.getVoices();
    if (settings.voice) {
      const match = voices.find(v => v.name === settings.voice);
      if (match) utterance.voice = match;
    }

    // Events
    utterance.onstart = () => {
      isPlaying = true;
      isPaused = false;
      isBanglaMode = false;
      updateButtonState('playing');
    };

    utterance.onend = () => {
      isPlaying = false;
      isPaused = false;
      updateButtonState('idle');
      setTimeout(() => { if (!isPlaying) hideButton(); }, 800);
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled') return;
      console.error('[SpeakIt] Speech error:', e.error);
      isPlaying = false;
      isPaused = false;
      updateButtonState('error');
      showToast('Speech error: ' + e.error, 'error');
      setTimeout(() => updateButtonState('idle'), 1500);
    };

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  }

  function pauseSpeaking() {
    if (isBanglaMode && banglaAudio) {
      banglaAudio.pause();
    } else {
      speechSynthesis.pause();
    }
    isPaused = true;
    updateButtonState('paused');
  }

  function resumeSpeaking() {
    if (isBanglaMode && banglaAudio) {
      banglaAudio.play();
    } else {
      speechSynthesis.resume();
    }
    isPaused = false;
    updateButtonState('playing');
  }

  function stopSpeaking() {
    if (isBanglaMode && banglaAudio) {
      banglaAudio.pause();
      banglaAudio.currentTime = 0;
      banglaAudio = null;
    }
    speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    isBanglaMode = false;
    currentUtterance = null;
    updateButtonState('idle');
  }

  // ─── Button State ──────────────────────────────────────────
  function updateButtonState(state) {
    if (!speakBtn) return;
    speakBtn.classList.remove('speakit-playing', 'speakit-loading', 'speakit-error');

    switch (state) {
      case 'playing':
        speakBtn.innerHTML = ICONS.pause;
        speakBtn.classList.add('speakit-playing');
        speakBtn.setAttribute('aria-label', 'Pause speech');
        break;
      case 'paused':
        speakBtn.innerHTML = ICONS.resume;
        speakBtn.classList.add('speakit-playing');
        speakBtn.setAttribute('aria-label', 'Resume speech');
        break;
      case 'loading':
        speakBtn.innerHTML = ICONS.loading;
        speakBtn.classList.add('speakit-loading');
        speakBtn.setAttribute('aria-label', 'Loading speech');
        break;
      case 'error':
        speakBtn.innerHTML = ICONS.speak;
        speakBtn.classList.add('speakit-error');
        speakBtn.setAttribute('aria-label', 'Speech error');
        break;
      case 'idle':
      default:
        speakBtn.innerHTML = ICONS.speak;
        speakBtn.setAttribute('aria-label', 'Speak selected text');
        break;
    }
  }

  // ─── Cleanup on page unload ─────────────────────────────────
  window.addEventListener('beforeunload', () => {
    speechSynthesis.cancel();
    if (banglaAudio) { banglaAudio.pause(); banglaAudio = null; }
  });

})();
