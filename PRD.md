# PRD: Supercharger for ChatGPT

## Problem
When ChatGPT conversations get long (100+ messages), the browser grinds to a halt. Typing lags, scrolling stutters, CPU spikes, and Chrome becomes nearly unusable. This is because ChatGPT renders every single message in the DOM — hundreds of complex HTML elements with code blocks, markdown, images, and nested structures. The browser can't handle the layout and paint calculations for all of it simultaneously.

This is a pure client-side rendering problem. OpenAI hasn't fixed it. The existing solution (Speed Booster for ChatGPT) charges $7.99 for full functionality and limits free users to 30 lag-free prompts per day.

## Solution
**Supercharger for ChatGPT** — a free, open-source Chrome extension that virtualizes ChatGPT's message list. It hides older messages from the DOM (using `display: none`) so the browser only renders the most recent ones. Users can load older messages on demand by scrolling up and clicking "Load more."

## Target User
Anyone who uses ChatGPT for long sessions — coders, writers, researchers, power users. People who've experienced the lag and either suffer through it or start new chats to avoid it.

## Key Principles
1. **100% Free** — No paid tier. No limits. No "upgrade to PRO" nags. Ever.
2. **Zero Config** — Install and forget. Works automatically on every ChatGPT conversation.
3. **100% Private** — All processing happens locally. No data leaves the browser. No analytics. No tracking.
4. **Minimal Footprint** — Tiny extension size. No frameworks. No build tools. Plain JavaScript.
5. **Open Source** — Full transparency. Anyone can audit the code.

## Features

### V1.0 (MVP)
- [ ] **Auto-trim messages** — When a conversation exceeds N messages (default: 50), hide older messages
- [ ] **"Load more" button** — Appears at top of chat, reveals next batch of hidden messages when clicked
- [ ] **Status banner** — Shows "Supercharger Active — X messages optimized" at top of conversation
- [ ] **Popup UI** — Toggle extension on/off, adjust visible message count via slider
- [ ] **Settings persistence** — Remember user's preferred message count across sessions
- [ ] **Auto-detect new messages** — MutationObserver re-trims when new messages are added

### V1.1 (Fast Follow)
- [ ] **Firefox support** — Port to Firefox Add-ons
- [ ] **Keyboard shortcut** — Quick toggle on/off
- [ ] **Per-conversation memory** — Remember scroll position per chat

### Future Considerations
- Landing page / marketing site
- Edge/Brave/Arc support (Chromium-based should work automatically)

## Technical Spec

### Manifest V3
```json
{
  "manifest_version": 3,
  "name": "Supercharger for ChatGPT",
  "permissions": ["storage"],
  "host_permissions": ["https://chatgpt.com/*"],
  "content_scripts": [{
    "matches": ["https://chatgpt.com/*"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  }
}
```

### Content Script Logic
1. Wait for conversation container to appear in DOM
2. Set up MutationObserver on the container
3. On mutation (new messages added):
   a. Count all message elements (`[data-testid^="conversation-turn-"]`)
   b. If count > threshold, hide oldest messages via `display: none`
   c. Insert/update "Load more" button at top if hidden messages exist
   d. Insert/update status banner showing optimization count
4. "Load more" button reveals next batch (default batch size: 20)
5. Listen for navigation events (ChatGPT is an SPA — URL changes without page reload)

### Popup UI
- Toggle switch: Enable/Disable Supercharger
- Slider: Number of visible messages (10–200, default 50)
- Stats display: Messages optimized in current chat
- Clean, minimal design matching ChatGPT's aesthetic

### Privacy
- `content_scripts` only runs on `chatgpt.com`
- No `tabs`, `webRequest`, or broad permissions
- `storage` permission only for saving user preferences locally
- No external network requests whatsoever

## Success Metrics
- Chrome Web Store rating > 4.5 stars
- 10,000+ users within first 3 months
- Zero privacy complaints
- Works reliably across ChatGPT UI updates

## Competitive Landscape
| Feature | Speed Booster (competitor) | Supercharger (us) |
|---|---|---|
| Price | $7.99 PRO | Free forever |
| Daily limits | 30 prompts (free tier) | Unlimited |
| Custom thresholds | PRO only | Free |
| Open source | No | Yes |
| Data collection | Unknown | Zero |
| Quiet mode | PRO only | Default (no nags) |

## Risk
- **ChatGPT DOM changes** — OpenAI can change their HTML structure at any time. Mitigation: use resilient selectors, monitor for breakage, ship fixes fast.
- **OpenAI fixes the lag themselves** — Unlikely short-term given it's been an issue for 2+ years. If they do, great — problem solved for everyone.
