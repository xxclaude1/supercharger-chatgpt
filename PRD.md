# PRD — ChatGPT Turbo

## 1. Problem Statement

ChatGPT's web interface renders every message in a conversation as a full DOM node. In long conversations (50–500+ messages), this causes severe browser performance degradation:

- **Typing lag:** 200ms–2s input delay
- **Scroll jitter:** Dropped frames and freezing during scroll
- **High resource usage:** 1–4GB RAM, sustained CPU spikes
- **Battery drain:** Noticeable on laptops during extended sessions

This affects power users — developers, researchers, writers — who rely on long-running conversations daily.

### Market Validation
- **Speed Booster for ChatGPT** (competitor): 20,000+ users, 4.6★ rating (191 reviews), charges for PRO features
- **GPT Boost:** 4.1★, similar approach
- **LightSession Pro:** 4.1★, DOM trimming approach
- **Gippity Pruner:** 5.0★ (few reviews), newer entrant

This is a validated problem with proven demand. Existing solutions charge money or have daily usage limits.

## 2. Solution

**ChatGPT Turbo** — a free, open-source Chrome extension that keeps only the most recent N messages rendered in the DOM, hiding older messages to eliminate lag.

### Core Mechanism
1. Content script injects on `chatgpt.com`
2. Identifies all message `<article>` elements
3. Hides all but the most recent N messages (`display: none`)
4. Inserts a "Load more" button above the first visible message
5. MutationObserver re-trims when new messages arrive
6. Polling backup catches SPA navigation edge cases

### Key Differentiators vs. Competitors
| Feature | ChatGPT Turbo | Speed Booster | GPT Boost |
|---------|:---:|:---:|:---:|
| **Price** | Free forever | Freemium ($) | Freemium |
| **Open source** | ✅ MIT | ❌ | ❌ |
| **Daily limits** | None | 30 chats/day free | Unknown |
| **Data collection** | None | Claims none | Unknown |
| **Configurable threshold** | ✅ 10–100 | PRO only | ✅ |
| **Build tools required** | None | Unknown | Unknown |

## 3. User Personas

### Primary: The Power Coder
- Uses ChatGPT for multi-hour coding sessions
- Conversations reach 100–300 messages
- Notices lag after ~50 messages
- Technically savvy, comfortable installing extensions

### Secondary: The Researcher / Writer
- Uses ChatGPT for long brainstorming or writing sessions
- Less technical but recognizes performance issues
- Values simplicity — install and forget

## 4. Feature Requirements

### P0 — Must Have (v1.0)
- [ ] DOM trimming of older messages (display: none)
- [ ] Configurable visible message count (10–100, default 30)
- [ ] "Load more messages" button above first visible message
- [ ] Floating status badge showing trim state
- [ ] Popup UI with toggle on/off and message count slider
- [ ] Automatic re-trim when new messages arrive (MutationObserver)
- [ ] SPA navigation detection (conversation switching)
- [ ] Settings persistence via localStorage
- [ ] Works on chatgpt.com

### P1 — Should Have (v1.1)
- [ ] Auto-detect optimal visible count based on device performance
- [ ] Keyboard shortcut to toggle trimming
- [ ] "Scroll to bottom" quick button
- [ ] Memory usage indicator in popup
- [ ] Support for chat branching / regenerated responses

### P2 — Nice to Have (v1.2+)
- [ ] Firefox support (manifest v2 compatibility)
- [ ] Safari support (Web Extension)
- [ ] Export conversation as markdown
- [ ] Dark/light theme matching ChatGPT's current theme

## 5. Technical Architecture

```
┌──────────────────────────────────────────────┐
│                   Chrome                     │
│                                              │
│  ┌──────────┐    chrome.runtime     ┌──────┐ │
│  │ popup.js │◄──── messages ───────►│      │ │
│  │ popup.html│                      │ cont │ │
│  └──────────┘                      │ ent. │ │
│                                    │  js   │ │
│  ┌──────────────────────────┐      │      │ │
│  │     chatgpt.com DOM      │      │      │ │
│  │                          │◄─────│      │ │
│  │  article (hidden)        │ hide │      │ │
│  │  article (hidden)        │      │      │ │
│  │  article (hidden)        │      │      │ │
│  │  [Load more] button      │      │      │ │
│  │  article (visible) ✓     │      │      │ │
│  │  article (visible) ✓     │      │      │ │
│  │  article (visible) ✓     │      └──────┘ │
│  └──────────────────────────┘               │
└──────────────────────────────────────────────┘
```

### Communication Flow
1. **Content script → DOM:** Direct manipulation (querySelector, style changes)
2. **Popup → Content script:** `chrome.tabs.sendMessage()` for settings changes
3. **Content script → Popup:** Response to `GET_STATUS` messages
4. **Persistence:** `localStorage` on chatgpt.com domain

## 6. Chrome Web Store Listing

### Title
ChatGPT Turbo – Kill Lag in Long Chats (Free & Open Source)

### Short Description
Instantly eliminate lag, freezing, and jitter in long ChatGPT conversations. Free forever. No data collection. Open source.

### Full Description

**Stop ChatGPT from lagging — instantly and for free.**

ChatGPT Turbo makes massive conversations smooth again by rendering only the most recent messages. No lost context, no data collection, no paywalls. Ever.

If you use ChatGPT for coding, writing, research, or long discussions, you know the pain: once a chat gets long, Chrome grinds to a halt. Typing lags, scrolling stutters, and your fans spin up.

ChatGPT Turbo fixes this in one click.

**⚡ What it does**

Keeps ChatGPT blazing fast — even in threads with 500+ messages — by rendering only the latest messages. Configure exactly how many to keep visible.

Older messages are one click away: scroll up and hit "Load more messages." Your full history stays intact.

**✅ Why you'll love it**

- Instant, lag-free typing and scrolling — even in enormous threads
- Dramatically lower CPU and memory usage — Chrome stays responsive
- No lost messages — your complete conversation history is untouched
- Works automatically — install once and forget about it
- Configure your own threshold — show 10, 30, 50, or 100 messages

**🔒 100% Privacy — Verified by Open Source**

All logic runs entirely on your device. Your chat data never leaves your browser.
No data collection. No tracking. No analytics. No network requests. Period.

Don't just take our word for it — read every line of our code on GitHub.

**🆓 Free Forever — No Tricks**

No "PRO" tier. No daily limits. No feature gates. No ads. No upsells.
This is a community tool, built in the open, for everyone.

**🛠 How it Works**

The extension renders only the most recent messages to keep your browser fast. Need to see older parts of the conversation? Just scroll up and hit "Load more." Your full history remains safely on OpenAI's servers — we just make it easier for your browser to handle.

This extension is an independent project and is not affiliated with, endorsed by, or sponsored by OpenAI or ChatGPT.

## 7. Success Metrics
- **Primary:** Chrome Web Store rating ≥ 4.5★
- **Secondary:** 10,000 users within 3 months
- **Technical:** <1% of users reporting broken functionality per ChatGPT update

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChatGPT changes DOM structure | Extension breaks | Multiple fallback selectors, polling-based detection, fast update cycle |
| Chrome MV3 API changes | Extension needs updates | Minimal API surface (only content script + popup) |
| Users report "missing messages" | Negative reviews | Clear "Load more" UI, status badge, educational popup text |
| Competitor with better UX | Slower growth | Open source advantage, zero cost, community contributions |
