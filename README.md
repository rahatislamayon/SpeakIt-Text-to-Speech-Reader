<p align="center">
  <img src="icons/banner.png" alt="SpeakIt Banner" width="100%"/>
</p>

<h1 align="center">SpeakIt</h1>

<p align="center">
  <strong>A lightweight, privacy-first Text-to-Speech Chrome extension.</strong><br>
  Select any text on any webpage. Click. Listen.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/version-1.0.0-green?style=flat-square" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/platform-Chrome-orange?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome"/>
  <img src="https://img.shields.io/badge/bangla-supported-blueviolet?style=flat-square" alt="Bangla Supported"/>
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Demo](#-demo)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Bangla TTS (বাংলা)](#-bangla-tts-বাংলা)
- [Settings](#%EF%B8%8F-settings)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Permissions](#-permissions)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

**SpeakIt** is a Chrome extension built on **Manifest V3** that converts highlighted webpage text into speech using the browser's native [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). It also includes a companion local server for **Bangla (বাংলা) text-to-speech** using [gTTS](https://github.com/pndurette/gTTS).

No accounts. No cloud APIs for English. No tracking. Just highlight, click, and listen.

---

## 🎬 Demo

1. **Select** any text on a webpage  
2. A floating **🔊 Speak** button appears near your selection  
3. Click it to **listen** — pause, resume, or stop anytime

> **Tip:** Use keyboard shortcut `Ctrl+Shift+S` to speak without clicking.

---

## ✨ Features

| Feature | Description |
|---|---|
| **One-Click TTS** | Select text → floating button → instant speech |
| **Dual Engine** | Web Speech API for system voices + gTTS for Bangla |
| **Full Playback Control** | Play, Pause, Resume, Stop |
| **Keyboard Shortcuts** | `Ctrl+Shift+S` to speak, `Ctrl+Shift+X` to stop |
| **Voice Selection** | Choose from all OS-installed voices + Bangla |
| **Speed Control** | 0.5× to 2.0× playback rate |
| **Pitch Control** | Adjustable pitch (0.5–2.0) |
| **Volume Control** | 0% to 100% |
| **Button Position** | Configurable: top-right, top-left, bottom-right, bottom-left |
| **Scroll Awareness** | Button repositions during playback instead of hiding |
| **Settings Sync** | Preferences saved via `chrome.storage.sync` |
| **Privacy First** | No analytics, no data collection, fully local for English |
| **Dark Theme UI** | Premium glassmorphism settings popup |
| **Accessibility** | ARIA labels, keyboard navigation, screen-reader friendly |

---

## 🚀 Installation

### From Source (Developer Mode)

```bash
# 1. Clone the repository
git clone https://github.com/rahatislamayon/SpeakIt-Text-to-Speech-Reader.git

# 2. Open Chrome Extensions page
#    Navigate to: chrome://extensions/

# 3. Enable "Developer mode" (top-right toggle)

# 4. Click "Load unpacked" → select the cloned folder
```

### Quick Install

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. SpeakIt icon appears in your toolbar — ready to go ✅

---

## 🎯 Usage

### Basic

```
1. Navigate to any webpage
2. Select (highlight) any text
3. Click the floating 🔊 button that appears
4. Listen — use the button to pause/resume/stop
```

### With Keyboard

| Action | Windows / Linux | macOS |
|---|---|---|
| Speak selected text | `Ctrl + Shift + S` | `⌘ + Shift + S` |
| Stop speaking | `Ctrl + Shift + X` | `⌘ + Shift + X` |

### Button States

| State | Icon | Meaning |
|---|---|---|
| Idle | 🔊 Speaker | Ready to speak |
| Playing | ⏸ Pause | Click to pause |
| Paused | ▶ Play | Click to resume |
| Loading | ⟳ Spinner | Bangla TTS generating audio |
| Error | 🔊 Red | Something went wrong |

---

## 🇧🇩 Bangla TTS (বাংলা)

SpeakIt includes built-in **Bangla text-to-speech** support via a companion local Python server.

### Why a Local Server?

Chrome's Web Speech API only supports voices installed on the OS. Windows doesn't ship with a Bengali TTS voice by default, so SpeakIt includes a lightweight Flask server that uses Google Translate's TTS engine.

### Setup

```bash
# Prerequisites: Python 3.6+

# Navigate to the server directory
cd server/

# Install dependencies
pip install -r requirements.txt

# Start the server
python bangla_server.py
```

**Or simply double-click `server/start_server.bat`** (Windows).

### How It Works

```
┌──────────────┐     POST /speak      ┌──────────────────┐
│   Chrome     │ ──────────────────►  │  Flask Server     │
│   Extension  │     { text, voice }  │  (localhost:5588) │
│              │ ◄──────────────────  │                   │
│              │   base64 MP3 audio   │  gTTS → Google    │
└──────────────┘                      └──────────────────┘
```

### Server Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/voices` | GET | List available Bangla voices |
| `/speak` | POST | Convert text → audio (returns base64 MP3) |

### Speak Request

```json
{
  "text": "আমি বাংলায় কথা বলতে পারি",
  "voice": "female",
  "format": "base64"
}
```

> **Note:** The server requires internet access (uses Google Translate). English voices work fully offline without the server.

---

## ⚙️ Settings

Click the SpeakIt icon in your toolbar to open the settings popup:

| Setting | Options | Default |
|---|---|---|
| **Enabled** | On / Off toggle | On |
| **Voice** | System voices + Bangla | System default |
| **Speed** | 0.5× – 2.0× | 1.0× |
| **Pitch** | 0.5 – 2.0 | 1.0 |
| **Volume** | 0% – 100% | 100% |
| **Button Position** | top-right, top-left, bottom-right, bottom-left | top-right |

---

## 📁 Project Structure

```
SpeakIt/
│
├── manifest.json              # Chrome Extension Manifest V3
├── popup.html                 # Settings popup UI
├── README.md
│
├── icons/
│   ├── icon16.png             # Toolbar icon (16×16)
│   ├── icon48.png             # Extensions page (48×48)
│   ├── icon128.png            # Chrome Web Store (128×128)
│   └── banner.png             # README banner
│
├── scripts/
│   ├── background.js          # Service worker — shortcuts, settings relay
│   ├── content.js             # Content script — selection, button, TTS engine
│   └── popup.js               # Popup logic — voice dropdown, settings
│
├── styles/
│   ├── content.css            # Floating button, tooltip, toast styles
│   └── popup.css              # Settings popup dark theme
│
└── server/                    # Bangla TTS companion server
    ├── bangla_server.py       # Flask + gTTS API (port 5588)
    ├── start_server.bat       # Windows one-click launcher
    └── requirements.txt       # Python dependencies
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Extension Platform | [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) |
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| English TTS Engine | [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) |
| Bangla TTS Engine | [gTTS](https://github.com/pndurette/gTTS) (Google Translate) |
| Server | [Flask](https://flask.palletsprojects.com/) + [Flask-CORS](https://flask-cors.readthedocs.io/) |
| Settings Storage | [`chrome.storage.sync`](https://developer.chrome.com/docs/extensions/reference/storage/) |
| Design Pattern | IIFE (content script isolation), Singleton (DOM elements) |

---

## 🔒 Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Access the active tab to inject the content script |
| `storage` | Persist user preferences across sessions |
| `host_permissions: localhost:5588` | Communicate with the local Bangla TTS server |

### Privacy

- 🟢 **English voices** — 100% local, zero network requests
- 🟡 **Bangla voices** — text sent to Google Translate TTS (same as translate.google.com)
- 🔴 **No analytics** — no tracking, no telemetry, no data collection

---

## ⌨️ Keyboard Shortcuts

Shortcuts can be customized at `chrome://extensions/shortcuts`.

| Command | Default Shortcut | Description |
|---|---|---|
| Speak Selected | `Ctrl+Shift+S` | Read the highlighted text aloud |
| Stop Speaking | `Ctrl+Shift+X` | Stop any ongoing speech |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

### Development

```bash
# Clone
git clone https://github.com/rahatislamayon/SpeakIt-Text-to-Speech-Reader.git

# Load in Chrome (Developer Mode)
# chrome://extensions/ → Load unpacked → select folder

# For Bangla TTS development
cd server/
pip install -r requirements.txt
python bangla_server.py
```

---

## 🗺 Roadmap

- [ ] Word-by-word highlighting during playback
- [ ] Text queue management (speak multiple selections)
- [ ] Right-click context menu integration
- [ ] Cloud TTS API support (premium voices)
- [ ] Firefox & Edge support
- [ ] Chrome Web Store publication

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License — free to use, modify, and distribute.
```

---

<p align="center">
  <sub>Built with ♥ using Vanilla JS & Web Speech API</sub><br>
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
