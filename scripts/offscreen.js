/**
 * SpeakIt — Offscreen Document Script
 * Used specifically to play TTS audio when the extension is triggered 
 * on pages where content scripts cannot run (e.g., PDF Viewer).
 */

let currentUtterance = null;
let banglaAudio = null;
let banglaChunks = [];
let banglaAudioElements = [];
let banglaChunkIdx = 0;
let isBanglaMode = false;
let isPlaying = false;
let currentSessionId = 0;

const BANGLA_TTS_CHUNK_SIZE = 200;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'offscreen-speak') {
    stopSpeaking(); // stop previous
    const { text, settings } = message;
    
    if (isBanglaVoice(settings.voice)) {
      speakBangla(text, settings);
    } else {
      speakSystem(text, settings);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'offscreen-stop') {
    stopSpeaking();
    sendResponse({ success: true });
    return true;
  }
});

function isBanglaVoice(voiceName) {
  return voiceName && voiceName.startsWith('bangla-');
}

function stopSpeaking() {
  if (isBanglaMode && banglaAudio) {
    banglaAudio.pause();
    banglaAudio.src = '';
    banglaAudio = null;
  }
  speechSynthesis.cancel();
  isPlaying = false;
  isBanglaMode = false;
  currentUtterance = null;
  banglaAudioElements = [];
}

function speakSystem(text, settings) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = settings.rate || 1.0;
  utterance.pitch = settings.pitch || 1.0;
  utterance.volume = settings.volume || 1.0;

  const voices = speechSynthesis.getVoices();
  if (settings.voice) {
    const match = voices.find(v => v.name === settings.voice);
    if (match) utterance.voice = match;
  }

  utterance.onstart = () => { isPlaying = true; isBanglaMode = false; };
  utterance.onend = () => { isPlaying = false; };
  utterance.onerror = () => { isPlaying = false; };

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

// ─── Bangla Pre-fetch Logic (same as content.js) ───

function chunkText(text, maxLen) {
  const chunks = [];
  const sentences = text.match(/[^।\.!?]+[।\.!?]*/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length > maxLen) {
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

function speakBangla(text, settings) {
  isBanglaMode = true;
  banglaChunks = chunkText(text, BANGLA_TTS_CHUNK_SIZE);
  banglaAudioElements = new Array(banglaChunks.length).fill(null);
  banglaChunkIdx = 0;
  currentSessionId++;

  prefetchChunk(0, currentSessionId, settings, () => {
    playNextBanglaChunk();
  });
}

function prefetchChunk(index, sessionId, settings, onFirstReady) {
  if (index >= banglaChunks.length || !isBanglaMode || sessionId !== currentSessionId) return;

  chrome.runtime.sendMessage(
    { action: 'bangla-tts', text: banglaChunks[index], speed: settings.rate },
    (response) => {
      if (!isBanglaMode || sessionId !== currentSessionId) return;

      if (!response || response.error) {
        console.error('[SpeakIt] Offscreen TTS error:', response?.error);
        if (index === 0) stopSpeaking();
        return;
      }

      const audioEl = new Audio(response.audio);
      audioEl.volume = settings.volume || 1.0;

      audioEl.onplay = () => { isPlaying = true; };
      audioEl.onended = () => {
        banglaChunkIdx++;
        playNextBanglaChunk();
      };
      audioEl.onerror = () => {
        console.error('[SpeakIt] Chunk audio error');
        if (index === 0) stopSpeaking();
      };

      banglaAudioElements[index] = audioEl;

      if (index === 0 && onFirstReady) onFirstReady();

      prefetchChunk(index + 1, sessionId, settings);
    }
  );
}

function playNextBanglaChunk() {
  if (banglaChunkIdx >= banglaChunks.length) {
    stopSpeaking();
    return;
  }

  const audioEl = banglaAudioElements[banglaChunkIdx];
  if (!audioEl) {
    setTimeout(playNextBanglaChunk, 200);
    return;
  }

  banglaAudio = audioEl;
  banglaAudio.play().catch(e => {
    console.error('[SpeakIt] Offscreen play error:', e);
    stopSpeaking();
  });
}
