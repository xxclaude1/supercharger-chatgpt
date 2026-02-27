# ⚡ ChatGPT Turbo

**Kill lag in long ChatGPT conversations. Free forever. Open source.**

ChatGPT Turbo is a Chrome extension that makes massive ChatGPT conversations smooth again by rendering only the most recent messages. No lost context, no data collection, no paywalls.

## The Problem

ChatGPT renders every message in the DOM. After 50+ messages, Chrome starts choking — typing lags, scrolling stutters, CPU spikes, battery drains.

## The Fix

ChatGPT Turbo hides older messages (`display: none`) so your browser only renders what's on screen. One "Load more" button reveals history on demand. Your messages are never deleted — just hidden from rendering.

## Install

### From Chrome Web Store
*(Coming soon)*

### Manual Install (Developer Mode)
1. Download or clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `chatgpt-turbo` folder
6. Open [chatgpt.com](https://chatgpt.com) and start chatting

## Features

- **Instant lag elimination** — even in 500+ message threads
- **Configurable threshold** — keep 10 to 100 messages visible (default: 30)
- **Load more button** — reveal older messages with one click
- **Auto-detection** — re-trims when new messages arrive
- **SPA-aware** — handles conversation switching gracefully
- **Tiny footprint** — <50KB, zero dependencies, no build step

## Privacy

Zero data collection. Zero network requests. Zero tracking. Everything runs locally in your browser. Read every line of code yourself — that's the point of open source.

## Free Forever

No PRO tier. No daily limits. No paywalls. No ads. No upsells. This is a community tool.

## Configuration

Click the extension icon in your toolbar to:
- Toggle Turbo mode on/off
- Adjust how many messages stay visible (10–100)
- See how many messages are currently trimmed

## How It Works

```
Before ChatGPT Turbo:          After ChatGPT Turbo:
┌─────────────────────┐        ┌─────────────────────┐
│ Message 1 (rendered)│        │ Message 1 (hidden)  │
│ Message 2 (rendered)│        │ Message 2 (hidden)  │
│ Message 3 (rendered)│        │ ...98 more hidden   │
│ ...                 │        │ [Load more messages] │
│ Message 99 (rendered│        │ Message 100 (render) │
│ Message 100 (render)│        │ Message 101 (render) │
│ = 100 DOM nodes     │        │ = 30 DOM nodes       │
│ = LAG 🐌            │        │ = FAST ⚡            │
└─────────────────────┘        └─────────────────────┘
```

## Contributing

PRs welcome! This project intentionally has:
- No build tools
- No external dependencies
- No framework — vanilla JS only

Just edit the files and reload the extension.

## License

MIT — do whatever you want with it.
