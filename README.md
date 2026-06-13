# AI Comment Generator

AI Comment Generator is a Chrome extension that helps you draft contextual, human-like replies for LinkedIn and Twitter/X posts in one click.

It supports:
- Google Gemini for cloud-based generation
- Local Ollama for on-device generation with selectable models

## Preview

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0f172a?style=for-the-badge)
![Gemini](https://img.shields.io/badge/Google-Gemini-2563eb?style=for-the-badge&logo=google&logoColor=white)
![Ollama](https://img.shields.io/badge/Local-Ollama-111827?style=for-the-badge)
![LinkedIn](https://img.shields.io/badge/LinkedIn-Supported-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)
![X](https://img.shields.io/badge/Twitter%2FX-Supported-000000?style=for-the-badge&logo=x&logoColor=white)

## Why This Project

Writing meaningful replies on social platforms takes time. This extension reduces the friction by letting you:
- detect posts directly in your feed
- open a lightweight reply generator modal
- choose tone, length, and intent
- generate a draft instantly
- edit before posting

The extension never auto-posts. You stay in control of the final reply.

## Features

- One-click `AI Reply` button injected into LinkedIn and X posts
- Context-aware reply generation from post content
- Tone selection: `Professional`, `Casual`, `Witty`
- Length selection: `Short`, `Medium`
- Intent selection: `Reply`, `Question`, `Appreciate`
- Provider switching between `Gemini` and `Ollama`
- Local Ollama model discovery from your running Ollama server
- Copy and insert reply actions
- Simple popup settings UI for configuration

## Tech Stack

- JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Content Scripts + Background Service Worker
- Google Gemini API
- Ollama Local API

## Supported Platforms

- LinkedIn
- Twitter / X

## Project Structure

```text
ai-comment-generator/
|-- manifest.json
|-- popup.html
|-- popup.js
|-- README.md
|-- icons/
|   |-- icon16.png
|   |-- icon48.png
|   `-- icon128.png
`-- src/
    |-- background.js
    |-- content-linkedin.js
    |-- content-twitter.js
    |-- content-utils.js
    `-- injected.css
```

## How It Works

### 1. Popup Settings

The popup lets you choose the AI provider:
- `Google Gemini`
- `Local Ollama`

For Gemini:
- save your API key in Chrome storage

For Ollama:
- enter your Ollama base URL
- refresh available models
- choose a local model

### 2. Content Scripts

The extension watches LinkedIn and X feeds using DOM observers and injects an `AI Reply` button near each post action bar.

### 3. Background Worker

When you click generate:
- the post content is packaged into a prompt
- the background service worker sends the request to Gemini or Ollama
- the generated response is returned to the modal

### 4. User Review

You can:
- regenerate
- copy
- insert into the active reply box

The extension does not auto-submit comments.

## Installation

### 1. Clone or Download

Download this repository or clone it locally.

```bash
git clone <your-repo-url>
```

### 2. Load the Extension

1. Open `chrome://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `ai-comment-generator` folder

## Provider Setup

### Option A: Google Gemini

1. Open the extension popup
2. Select `Google Gemini`
3. Create an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Paste the key
5. Save settings

### Option B: Local Ollama

1. Install and run [Ollama](https://ollama.com/)
2. Pull at least one model, for example:

```bash
ollama pull phi
```

or

```bash
ollama pull gemma3
```

3. Make sure Ollama is running on:

```text
http://localhost:11434
```

4. Allow browser extension origins in Ollama on Windows:

```powershell
setx OLLAMA_ORIGINS "chrome-extension://*"
```

5. Fully restart Ollama
6. Open the extension popup
7. Select `Local Ollama`
8. Click `Refresh`
9. Choose a model
10. Save settings

## Usage

1. Visit LinkedIn or Twitter/X
2. Find a post in the feed
3. Click `AI Reply`
4. Choose:
   - tone
   - length
   - intent
5. Click `Generate Reply`
6. Edit the response if needed
7. Click `Insert` or `Copy`
8. Review manually and post yourself

## Architecture Overview

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration, permissions, content scripts |
| `popup.html` | Popup UI |
| `popup.js` | Provider selection and settings logic |
| `src/background.js` | Routes requests to Gemini or Ollama |
| `src/content-linkedin.js` | LinkedIn detection, button injection, modal flow |
| `src/content-twitter.js` | Twitter/X detection, button injection, modal flow |
| `src/injected.css` | Modal and injected button styling |
| `src/content-utils.js` | Shared utility reference file |

## Privacy

- API keys are stored locally in `chrome.storage.sync`
- Ollama requests stay on your local machine
- Gemini requests go directly to Google's API
- The extension does not auto-post
- No generated reply is stored remotely by the extension itself

## Known Notes

- LinkedIn and X update their DOM regularly, so selectors may occasionally need adjustment
- Ollama requires origin access for Chrome extensions
- Large local models may respond more slowly than Gemini

## Roadmap

- Reddit support
- Better thread/context awareness
- More tones and custom prompt styles
- Multi-language generation
- Learn from user-edited replies

## GitHub Topics

Add these as repository topics on GitHub:

```text
chrome-extension
browser-extension
manifest-v3
javascript
gemini-api
ollama
local-llm
linkedin
twitter
x-com
ai-tools
social-media
productivity
```

## Portfolio Summary

If you want to show this on your GitHub profile or portfolio, you can describe it like this:

> Built a Chrome extension that generates contextual social media replies for LinkedIn and X using either Google Gemini or locally hosted Ollama models, with dynamic DOM injection, provider switching, and a human-in-the-loop posting workflow.

## License

Choose a license before publishing publicly. If you want, I can add an MIT license file next.
