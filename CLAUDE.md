# CLAUDE.md – ChatGPT Turbo

## Project Overview
**ChatGPT Turbo** is a free, open-source Chrome extension that eliminates browser lag, freezing, and jitter in long ChatGPT conversations. It works by intelligently trimming the DOM — hiding older messages that cause rendering slowdowns while keeping them instantly accessible via a "Load more" button.

## Core Philosophy
- **Free forever.** No paywalls, no pro tiers, no freemium gates. Zero monetization.
- **Privacy-first.** No data collection, no analytics, no tracking. Everything runs locally.
- **Minimal & surgical.** One job, done well. No bloat, no feature creep.

## How It Works
ChatGPT renders every message turn as a DOM node (an `<article>` element). In conversations with 100+ messages, the browser struggles to layout, paint, and composite thousands of nested DOM elements. This causes:
- Typing lag and input delay
- Scroll jitter and freezing
- High CPU/memory usage
- Battery drain on laptops

**Our solution:** Hide older messages via `display: none`, keeping only the N most recent visible. A MutationObserver watches for new messages and re-trims. A floating "Load more" button lets users reveal older messages on demand.

**Key architectural decisions:**
- We **never delete** messages from the DOM — only hide them with CSS
- We use `display: none` which fully removes elements from layout (not `visibility: hidden`)
- We use `MutationObserver` + polling as a safety net for SPA navigation
- Settings persist in `localStorage` scoped to chatgpt.com
- All logic runs in a content script — no background service worker needed

## Tech Stack
- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** — no frameworks, no build tools, no dependencies
- **CSS** — injected styles for the Load More button and status badge

## Project Structure
```
chatgpt-turbo/
├── manifest.json          # Extension manifest (MV3)
├── src/
│   ├── content.js         # Core engine — DOM trimming logic
│   ├── styles.css         # Injected CSS for UI elements
│   ├── popup.html         # Toolbar popup UI
│   └── popup.js           # Popup interaction logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── landing-page/
│   └── index.html         # Marketing landing page
├── CLAUDE.md              # This file
├── PRD.md                 # Product requirements document
├── README.md              # Public README
└── LICENSE                # MIT License
```

## Key Selectors (ChatGPT DOM)
These are the CSS selectors we use to find messages. ChatGPT may change these — if the extension breaks, this is the first place to check:

- **Primary:** `article[data-testid^="conversation-turn"]`
- **Fallback 1:** `main article`
- **Fallback 2:** First scrollable div inside `main` with 5+ children

## Configuration Defaults
| Setting | Default | Range |
|---------|---------|-------|
| Visible messages | 30 | 10–100 |
| Poll interval | 1500ms | — |
| Load more batch | 20 | — |

## Development
```bash
# Load as unpacked extension:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the chatgpt-turbo/ folder

# No build step needed — it's vanilla JS
```

## ChatGPT DOM Changes
ChatGPT updates their UI frequently. If the extension breaks:
1. Open chatgpt.com, start a conversation
2. Open DevTools → Elements
3. Find the message containers (usually `<article>` tags)
4. Update selectors in `getMessageElements()` and `getConversationContainer()`
5. Test with a long conversation (50+ messages)

## Principles for Contributors
1. **No build tools.** The extension should work by loading the folder directly.
2. **No external dependencies.** Everything is vanilla JS/CSS.
3. **No data leaves the device.** Never add analytics, telemetry, or network requests.
4. **Keep it tiny.** Target < 50KB total extension size.
5. **Fail gracefully.** If selectors break, the page should still work normally — just without trimming.
