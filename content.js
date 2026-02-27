// Supercharger for ChatGPT — Content Script
// Trims older messages from the DOM to eliminate browser lag in long conversations.

(function () {
  "use strict";

  // --- Configuration ---
  const DEFAULT_VISIBLE = 50;
  const LOAD_MORE_BATCH = 20;
  const DEBOUNCE_MS = 300;
  const INIT_RETRY_MS = 500;
  const INIT_MAX_RETRIES = 30; // 15 seconds max wait for ChatGPT to load

  // Multi-tier message selectors (ordered by reliability)
  const MESSAGE_SELECTORS = [
    'article[data-testid^="conversation-turn-"]',
    '[data-testid^="conversation-turn"]',
    '[data-message-author-role]',
  ];

  // Container selectors (ordered by specificity)
  const CONTAINER_SELECTORS = [
    '[data-testid="conversation-turns"]',
    'main div[data-testid="conversation"]',
    '#thread',
    'main',
  ];

  // Streaming indicator — don't trim while GPT is generating
  const STREAMING_SELECTOR = '[data-testid="stop-button"]';

  // --- State ---
  let enabled = true;
  let visibleCount = DEFAULT_VISIBLE;
  let observer = null;
  let currentPath = location.pathname;
  let trimTimeout = null;
  let isTrimming = false;
  let activeMessageSelector = null;

  // --- Selector Detection ---

  function detectMessageSelector() {
    for (const sel of MESSAGE_SELECTORS) {
      if (document.querySelector(sel)) {
        activeMessageSelector = sel;
        return sel;
      }
    }
    return null;
  }

  function getMessages() {
    const sel = activeMessageSelector || detectMessageSelector();
    if (!sel) return [];
    return Array.from(document.querySelectorAll(sel));
  }

  function findContainer() {
    // Method 1: Use known container selectors
    for (const sel of CONTAINER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Method 2: Parent of first message
    const firstMsg = document.querySelector(
      MESSAGE_SELECTORS[0] || MESSAGE_SELECTORS[1]
    );
    if (firstMsg?.parentElement) return firstMsg.parentElement;
    return null;
  }

  function isStreaming() {
    return !!document.querySelector(STREAMING_SELECTOR);
  }

  // --- Banner UI ---

  function createBanner(hiddenCount) {
    let banner = document.getElementById("sc-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "sc-banner";
      banner.setAttribute("data-sc-element", "true");
      banner.style.cssText = [
        "background: #10a37f",
        "color: white",
        "text-align: center",
        "padding: 8px 16px",
        "font-size: 13px",
        "font-family: -apple-system, BlinkMacSystemFont, sans-serif",
        "position: sticky",
        "top: 0",
        "z-index: 9999",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "gap: 8px",
        "border-radius: 0 0 8px 8px",
      ].join(";");
      const icon = document.createElement("span");
      icon.textContent = "\u26A1";
      banner.appendChild(icon);
      const text = document.createElement("span");
      text.id = "sc-banner-text";
      banner.appendChild(text);
    }
    const textEl = banner.querySelector("#sc-banner-text");
    if (textEl) {
      textEl.textContent =
        "Supercharger Active \u2014 " +
        hiddenCount +
        " message" +
        (hiddenCount !== 1 ? "s" : "") +
        " optimized";
    }
    return banner;
  }

  function createLoadMoreButton(hiddenCount) {
    let btn = document.getElementById("sc-load-more");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "sc-load-more";
      btn.setAttribute("data-sc-element", "true");
      btn.style.cssText = [
        "display: block",
        "margin: 12px auto",
        "padding: 8px 20px",
        "background: #10a37f",
        "color: white",
        "border: none",
        "border-radius: 6px",
        "cursor: pointer",
        "font-size: 13px",
        "font-family: -apple-system, BlinkMacSystemFont, sans-serif",
        "transition: opacity 0.2s",
      ].join(";");
      btn.addEventListener("mouseenter", function () {
        btn.style.opacity = "0.85";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.opacity = "1";
      });
      btn.addEventListener("click", loadMore);
    }
    const count = Math.min(LOAD_MORE_BATCH, hiddenCount);
    btn.textContent =
      "Load " + count + " more message" + (count !== 1 ? "s" : "");
    return btn;
  }

  function removeBannerAndButton() {
    const banner = document.getElementById("sc-banner");
    const btn = document.getElementById("sc-load-more");
    if (banner) banner.remove();
    if (btn) btn.remove();
  }

  // --- Core Trim Logic ---

  function trim() {
    if (isTrimming) return;

    if (!enabled) {
      restoreAll();
      sendStats();
      return;
    }

    // Don't trim while ChatGPT is streaming a response
    if (isStreaming()) {
      scheduleTrim();
      return;
    }

    isTrimming = true;

    try {
      const messages = getMessages();
      const total = messages.length;

      if (total <= visibleCount) {
        removeBannerAndButton();
        sendStats();
        isTrimming = false;
        return;
      }

      const hideCount = total - visibleCount;
      let actualHidden = 0;

      for (let i = 0; i < total; i++) {
        if (i < hideCount) {
          if (messages[i].style.display !== "none") {
            messages[i].style.display = "none";
          }
          actualHidden++;
        } else {
          if (messages[i].style.display === "none") {
            messages[i].style.display = "";
          }
        }
      }

      if (actualHidden > 0) {
        const firstVisible = messages[hideCount];
        if (firstVisible && firstVisible.parentElement) {
          const container = firstVisible.parentElement;
          const banner = createBanner(actualHidden);
          const loadBtn = createLoadMoreButton(actualHidden);

          // Insert before the first visible message
          if (!banner.parentElement) {
            container.insertBefore(banner, firstVisible);
          } else {
            // Update existing banner text
            const textEl = banner.querySelector("#sc-banner-text");
            if (textEl) {
              textEl.textContent =
                "Supercharger Active \u2014 " +
                actualHidden +
                " message" +
                (actualHidden !== 1 ? "s" : "") +
                " optimized";
            }
          }

          if (!loadBtn.parentElement) {
            container.insertBefore(loadBtn, firstVisible);
          } else {
            const count = Math.min(LOAD_MORE_BATCH, actualHidden);
            loadBtn.textContent =
              "Load " + count + " more message" + (count !== 1 ? "s" : "");
          }
        }
      } else {
        removeBannerAndButton();
      }

      sendStats();
    } finally {
      isTrimming = false;
    }
  }

  function scheduleTrim() {
    if (trimTimeout) clearTimeout(trimTimeout);
    trimTimeout = setTimeout(trim, DEBOUNCE_MS);
  }

  function loadMore() {
    const messages = getMessages();
    const hiddenMessages = messages.filter(function (m) {
      return m.style.display === "none";
    });

    // Reveal the last N hidden messages (closest to visible area)
    const toReveal = hiddenMessages.slice(-LOAD_MORE_BATCH);
    for (let i = 0; i < toReveal.length; i++) {
      toReveal[i].style.display = "";
    }

    const remaining = hiddenMessages.length - toReveal.length;
    if (remaining <= 0) {
      removeBannerAndButton();
    } else {
      // Update banner and button text
      const banner = document.getElementById("sc-banner");
      if (banner) {
        const textEl = banner.querySelector("#sc-banner-text");
        if (textEl) {
          textEl.textContent =
            "Supercharger Active \u2014 " +
            remaining +
            " message" +
            (remaining !== 1 ? "s" : "") +
            " optimized";
        }
      }
      const btn = document.getElementById("sc-load-more");
      if (btn) {
        const count = Math.min(LOAD_MORE_BATCH, remaining);
        btn.textContent =
          "Load " + count + " more message" + (count !== 1 ? "s" : "");
      }
    }
    sendStats();
  }

  function restoreAll() {
    const messages = getMessages();
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].style.display === "none") {
        messages[i].style.display = "";
      }
    }
    removeBannerAndButton();
  }

  // --- Stats Communication ---

  function sendStats() {
    try {
      const messages = getMessages();
      const hidden = messages.filter(function (m) {
        return m.style.display === "none";
      }).length;
      chrome.runtime.sendMessage({
        type: "stats",
        total: messages.length,
        hidden: hidden,
        enabled: enabled,
      }).catch(function () {});
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  // --- MutationObserver ---

  function startObserver() {
    if (observer) observer.disconnect();

    const container = findContainer();
    if (!container) return;

    observer = new MutationObserver(function (mutations) {
      // Skip mutations caused by our own elements
      if (isTrimming) return;

      let hasRelevant = false;
      for (let i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Ignore mutations on our own injected elements
        if (
          m.target.getAttribute &&
          m.target.getAttribute("data-sc-element") === "true"
        ) {
          continue;
        }
        if (
          m.target.id === "sc-banner" ||
          m.target.id === "sc-load-more" ||
          m.target.id === "sc-banner-text"
        ) {
          continue;
        }
        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
          hasRelevant = true;
          break;
        }
      }

      if (hasRelevant) {
        scheduleTrim();
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // --- SPA Navigation ---

  function checkNavigation() {
    if (location.pathname !== currentPath) {
      currentPath = location.pathname;
      // Reset selector detection for new conversation
      activeMessageSelector = null;
      removeBannerAndButton();
      // Wait for new conversation DOM to load
      setTimeout(function () {
        detectMessageSelector();
        startObserver();
        trim();
      }, 800);
    }
  }

  // Listen for pushState/popState (SPA navigation)
  var origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(checkNavigation, 100);
  };
  window.addEventListener("popstate", function () {
    setTimeout(checkNavigation, 100);
  });

  // Fallback polling for navigation
  setInterval(checkNavigation, 2000);

  // --- Settings ---

  function loadSettings(callback) {
    chrome.storage.local.get(["enabled", "visibleCount"], function (result) {
      if (result.enabled !== undefined) enabled = result.enabled;
      if (result.visibleCount !== undefined) visibleCount = result.visibleCount;
      if (callback) callback();
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === "settingsChanged") {
      if (msg.enabled !== undefined) enabled = msg.enabled;
      if (msg.visibleCount !== undefined) visibleCount = msg.visibleCount;
      trim();
    }
    if (msg.type === "getStats") {
      const messages = getMessages();
      const hidden = messages.filter(function (m) {
        return m.style.display === "none";
      }).length;
      sendResponse({
        type: "stats",
        total: messages.length,
        hidden: hidden,
        enabled: enabled,
      });
    }
    return true; // Keep message channel open for sendResponse
  });

  // --- Initialization ---

  function waitForChat(retries) {
    if (retries <= 0) {
      // ChatGPT hasn't loaded messages yet — start observer anyway
      // and it'll pick up messages when they appear
      startObserver();
      return;
    }

    const sel = detectMessageSelector();
    if (sel) {
      // Found messages — start the engine
      startObserver();
      trim();
    } else {
      // No messages yet — retry
      setTimeout(function () {
        waitForChat(retries - 1);
      }, INIT_RETRY_MS);
    }
  }

  function init() {
    loadSettings(function () {
      waitForChat(INIT_MAX_RETRIES);
    });
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
