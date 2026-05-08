/**
 * SpeakIt — Popup Script
 * Manages the settings UI: voice selection, sliders, position, and persistence.
 */
(() => {
  'use strict';

  // ─── DOM Refs ──────────────────────────────────────────────
  const enabledCheckbox = document.getElementById('enabled-checkbox');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const voiceSelect = document.getElementById('voice-select');
  const rateSlider = document.getElementById('rate-slider');
  const rateValue = document.getElementById('rate-value');
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchValue = document.getElementById('pitch-value');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');
  const positionRadios = document.querySelectorAll('input[name="position"]');
  const resetBtn = document.getElementById('reset-btn');

  // ─── Init ──────────────────────────────────────────────────
  let voicesReady = false;

  loadSettings();
  populateVoices();

  // Voices may load async — this is the primary reliable path
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      populateVoices();
      // If settings loaded before voices, restore the saved voice now
      const pending = voiceSelect.dataset.pendingVoice;
      if (pending) {
        voiceSelect.value = pending;
        delete voiceSelect.dataset.pendingVoice;
      }
    };
  }

  // ─── Load Settings ─────────────────────────────────────────
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'get-settings' }, (settings) => {
      if (!settings) return;

      enabledCheckbox.checked = settings.enabled !== false;
      updateStatusUI(enabledCheckbox.checked);

      rateSlider.value = settings.rate ?? 1;
      pitchSlider.value = settings.pitch ?? 1;
      volumeSlider.value = settings.volume ?? 1;

      updateSliderDisplay(rateSlider, rateValue, '×');
      updateSliderDisplay(pitchSlider, pitchValue, '');
      updateVolumeDisplay();

      // Set position radio
      const pos = settings.buttonPosition || 'top-right';
      positionRadios.forEach(r => { r.checked = r.value === pos; });

      // Set voice — if voices are loaded set directly, otherwise defer
      if (settings.voice) {
        if (voicesReady) {
          voiceSelect.value = settings.voice;
        } else {
          voiceSelect.dataset.pendingVoice = settings.voice;
        }
      }
    });
  }

  // ─── Populate Voices ───────────────────────────────────────
  const BANGLA_SERVER = 'http://localhost:5588';

  async function populateVoices() {
    const voices = speechSynthesis.getVoices();

    voiceSelect.innerHTML = '';
    voicesReady = true;

    // Add Bangla TTS voices at the top
    try {
      const resp = await fetch(`${BANGLA_SERVER}/voices`, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) {
        const data = await resp.json();
        const bnGroup = document.createElement('optgroup');
        bnGroup.label = 'BN — বাংলা (Local Server)';
        data.voices.forEach(v => {
          const opt = document.createElement('option');
          opt.value = `bangla-${v.id}`;
          opt.textContent = `${v.name}`;
          bnGroup.appendChild(opt);
        });
        voiceSelect.appendChild(bnGroup);
      }
    } catch {
      // Server not running — add offline Bangla entries anyway
      const bnGroup = document.createElement('optgroup');
      bnGroup.label = 'BN — বাংলা (Server Offline)';
      const optF = document.createElement('option');
      optF.value = 'bangla-female';
      optF.textContent = 'বাংলা নারী (Bangla Female) ⚠️';
      optF.disabled = true;
      const optM = document.createElement('option');
      optM.value = 'bangla-male';
      optM.textContent = 'বাংলা পুরুষ (Bangla Male) ⚠️';
      optM.disabled = true;
      bnGroup.appendChild(optF);
      bnGroup.appendChild(optM);
      voiceSelect.appendChild(bnGroup);
    }

    // Add system voices (grouped by language)
    if (voices.length > 0) {
      const groups = {};
      voices.forEach(v => {
        const lang = v.lang.split('-')[0].toUpperCase();
        if (!groups[lang]) groups[lang] = [];
        groups[lang].push(v);
      });

      Object.keys(groups).sort().forEach(lang => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = lang;
        groups[lang].sort((a, b) => a.name.localeCompare(b.name)).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.name;
          opt.textContent = `${v.name}${v.default ? ' ★' : ''}`;
          optgroup.appendChild(opt);
        });
        voiceSelect.appendChild(optgroup);
      });
    }

    // Restore selection
    const pending = voiceSelect.dataset.pendingVoice;
    if (pending) {
      voiceSelect.value = pending;
      delete voiceSelect.dataset.pendingVoice;
    }
  }

  // ─── Slider Helpers ────────────────────────────────────────
  function updateSliderDisplay(slider, label, suffix) {
    const val = parseFloat(slider.value).toFixed(1);
    label.textContent = val + suffix;
    updateSliderProgress(slider);
  }

  function updateVolumeDisplay() {
    const pct = Math.round(parseFloat(volumeSlider.value) * 100);
    volumeValue.textContent = pct + '%';
    updateSliderProgress(volumeSlider);
  }

  function updateSliderProgress(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--progress', pct + '%');
  }

  // ─── Status UI ─────────────────────────────────────────────
  function updateStatusUI(enabled) {
    if (enabled) {
      statusDot.classList.remove('disabled');
      statusText.textContent = 'Extension active';
    } else {
      statusDot.classList.add('disabled');
      statusText.textContent = 'Extension disabled';
    }
  }

  // ─── Save on Change ────────────────────────────────────────
  function save(key, value) {
    chrome.storage.sync.set({ [key]: value });
  }

  enabledCheckbox.addEventListener('change', () => {
    const on = enabledCheckbox.checked;
    save('enabled', on);
    updateStatusUI(on);
  });

  voiceSelect.addEventListener('change', () => {
    save('voice', voiceSelect.value);
  });

  rateSlider.addEventListener('input', () => {
    updateSliderDisplay(rateSlider, rateValue, '×');
    save('rate', parseFloat(rateSlider.value));
  });

  pitchSlider.addEventListener('input', () => {
    updateSliderDisplay(pitchSlider, pitchValue, '');
    save('pitch', parseFloat(pitchSlider.value));
  });

  volumeSlider.addEventListener('input', () => {
    updateVolumeDisplay();
    save('volume', parseFloat(volumeSlider.value));
  });

  positionRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) save('buttonPosition', r.value);
    });
  });

  // ─── Reset Defaults ────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'reset-settings' }, (resp) => {
      if (resp?.settings) loadSettings();
    });
  });

})();
