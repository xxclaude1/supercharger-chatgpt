# Supercharger for ChatGPT

## What This Is
A free Chrome extension that eliminates browser lag and freezing in long ChatGPT conversations by virtualizing the DOM — rendering only the most recent messages and lazy-loading older ones on demand.

## Core Principle
**Eat the customer's complexity.** One click install, zero config needed, instantly works. The user should never think about this extension — it just makes ChatGPT fast.

## Technical Architecture

### How It Works
1. **Content Script** (`content.js`) runs on `chatgpt.com`
2. **MutationObserver** watches the conversation container for new messages
3. When message count exceeds threshold (default: 50), older messages get `display: none`
4. A "Load more messages" banner appears at the top of the chat
5. Clicking the banner reveals the next batch of hidden messages
6. **Popup UI** lets users toggle the extension and adjust visible message count

### Key Technical Details
- ChatGPT messages live in elements matching `[data-testid^="conversation-turn-"]`
- We use `display: none` (not DOM removal) — simpler, reversible, still eliminates layout/paint cost
- MutationObserver on the conversation container handles dynamic message loading
- All processing is 100% local — zero network calls, zero data collection
- Manifest V3 Chrome extension

### File Structure
```
supercharger-chatgpt/
├── manifest.json          # Extension manifest (V3)
├── content.js             # Core DOM trimming logic
├── popup.html             # Extension popup UI
├── popup.js               # Popup interaction logic
├── popup.css              # Popup styles
├── icons/                 # Extension icons (16, 48, 128px)
├── CLAUDE.md              # This file
├── PRD.md                 # Product requirements
├── STORE_LISTING.md       # Chrome Web Store copy
├── .gitignore
└── README.md              # (if needed)
```

## Development Rules
- **Everything is free.** No paid tier, no freemium, no limits. Period.
- **Privacy first.** Zero data collection, zero analytics, zero tracking. All processing local.
- **Keep it simple.** Minimal code, minimal permissions, minimal footprint.
- **No over-engineering.** This is a content script + popup. No build tools, no frameworks, no bundlers. Plain JS.
- **Test on chatgpt.com** with long conversations (100+ messages) to verify performance gains.

## Permissions Policy
- Only request `activeTab` and host permission for `chatgpt.com` — nothing else.
- No `storage` permission unless absolutely needed for settings persistence (use chrome.storage.local if needed).

## Competitive Edge
- **100% free** (competitor charges $7.99 for PRO)
- **No limits** (competitor limits free tier to 30 lag-free prompts/day)
- **Open source** (competitor is closed source)
- **Simpler, lighter** — no bloat, no upsell banners, no license management
