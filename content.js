// Supercharger for ChatGPT — Content Script
// Trims older messages from the DOM to eliminate browser lag in long conversations.

(function () {
  "use strict";

  const DEFAULT_VISIBLE = 50;
  const LOAD_MORE_BATCH = 20;
  const POLL_INTERVAL = 1000;
  const MESSAGE_SELECTOR = '[data-testid^="conversation-turn-"]';

  let enabled = true;
  let visibleCount = DEFAULT_VISIBLE;
  let observer = null;
  let currentPath = location.pathname;

  // --- State ---

  function getMessages() {
    return Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
  }

  // --- Banner UI ---

  function createBanner(hiddenCount) {
    let banner = document.getElementById("sc-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "sc-banner";
      banner.style.cssText =
        "background: #10a37f; color: white; text-align: center; padding: 8px 16px; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; position: sticky; top: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 0 0 8px 8px;";
      const icon = document.createElement("span");
      icon.textContent = "\u26A1";
      banner.appendChild(icon);
      const text = document.createElement("span");
      text.id = "sc-banner-text";
      banner.appendChild(text);
    }
    const textEl = banner.querySelector("#sc-banner-text");
    if (textEl) {
      textEl.textContent = `Supercharger Active — ${hiddenCount} message${hiddenCount !== 1 ? "s" : ""} optimized`;
    }
    return banner;
  }

  function createLoadMoreButton(hiddenCount) {
    let btn = document.getElementById("sc-load-more");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "sc-load-more";
      btn.style.cssText =
        "display: block; margin: 12px auto; padding: 8px 20px; background: #10a37f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; transition: opacity 0.2s;";
      btn.addEventListener("mouseenter", () => (btn.style.opacity = "0.85"));
      btn.addEventListener("mouseleave", () => (btn.style.opacity = "1"));
      btn.addEventListener("click", loadMore);
    }
    btn.textContent = `Load ${Math.min(LOAD_MORE_BATCH, hiddenCount)} more message${Math.min(LOAD_MORE_BATCH, hiddenCount) !== 1 ? "s" : ""}`;
    return btn;
  }

  function removeBannerAndButton() {
    const banner = document.getElementById("sc-banner");
    const btn = document.getElementById("sc-load-more");
    if (banner) banner.remove();
    if (btn) btn.remove();
  }

  // --- Core Logic ---

  function trim() {
    if (!enabled) {
      restoreAll();
      return;
    }

    const messages = getMessages();
    const total = messages.length;

    if (total <= visibleCount) {
      removeBannerAndButton();
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
      // Insert banner and load-more button
      const container = messages[0].parentElement;
      if (container) {
        const banner = createBanner(actualHidden);
        const loadBtn = createLoadMoreButton(actualHidden);

        // Find the first visible message
        const firstVisible = messages[hideCount];
        if (firstVisible) {
          if (!banner.parentElement) {
            container.insertBefore(banner, firstVisible);
          }
          if (!loadBtn.parentElement) {
            container.insertBefore(loadBtn, firstVisible);
          }
        }

        // Update text on existing elements
        const textEl = banner.querySelector("#sc-banner-text");
        if (textEl) {
          textEl.textContent = `Supercharger Active — ${actualHidden} message${actualHidden !== 1 ? "s" : ""} optimized`;
        }
        loadBtn.textContent = `Load ${Math.min(LOAD_MORE_BATCH, actualHidden)} more message${Math.min(LOAD_MORE_BATCH, actualHidden) !== 1 ? "s" : ""}`;
      }
    } else {
      removeBannerAndButton();
    }

    // Notify popup of stats
    chrome.runtime.sendMessage({
      type: "stats",
      total: total,
      hidden: actualHidden,
      enabled: enabled,
    }).catch(() => {}); // Popup may not be open
  }

  function loadMore() {
    const messages = getMessages();
    const hiddenMessages = messages.filter((m) => m.style.display === "none");
    const toReveal = hiddenMessages.slice(-LOAD_MORE_BATCH);

    toReveal.forEach((m) => (m.style.display = ""));

    // Re-run trim logic to update banner/button
    const remaining = hiddenMessages.length - toReveal.length;
    if (remaining <= 0) {
      removeBannerAndButton();
    } else {
      const banner = document.getElementById("sc-banner");
      const btn = document.getElementById("sc-load-more");
      if (banner) {
        const textEl = banner.querySelector("#sc-banner-text");
        if (textEl) {
          textEl.textContent = `Supercharger Active — ${remaining} message${remaining !== 1 ? "s" : ""} optimized`;
        }
      }
      if (btn) {
        btn.textContent = `Load ${Math.min(LOAD_MORE_BATCH, remaining)} more message${Math.min(LOAD_MORE_BATCH, remaining) !== 1 ? "s" : ""}`;
      }
    }
  }

  function restoreAll() {
    const messages = getMessages();
    messages.forEach((m) => {
      if (m.style.display === "none") {
        m.style.display = "";
      }
    });
    removeBannerAndButton();
  }

  // --- Observer ---

  function startObserver() {
    if (observer) observer.disconnect();

    const watchTarget = document.querySelector("main") || document.body;

    observer = new MutationObserver((mutations) => {
      // Debounce: only trim if there are relevant changes
      let hasRelevant = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
          hasRelevant = true;
          break;
        }
      }
      if (hasRelevant) {
        requestAnimationFrame(trim);
      }
    });

    observer.observe(watchTarget, { childList: true, subtree: true });
  }

  // --- SPA Navigation Detection ---

  function checkNavigation() {
    if (location.pathname !== currentPath) {
      currentPath = location.pathname;
      // New conversation loaded — re-trim after a short delay for DOM to settle
      removeBannerAndButton();
      setTimeout(trim, 500);
    }
  }

  // --- Settings ---

  function loadSettings() {
    chrome.storage.local.get(["enabled", "visibleCount"], (result) => {
      if (result.enabled !== undefined) enabled = result.enabled;
      if (result.visibleCount !== undefined) visibleCount = result.visibleCount;
      trim();
    });
  }

  // Listen for settings changes from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "settingsChanged") {
      if (msg.enabled !== undefined) enabled = msg.enabled;
      if (msg.visibleCount !== undefined) visibleCount = msg.visibleCount;
      trim();
    }
    if (msg.type === "getStats") {
      const messages = getMessages();
      const hidden = messages.filter((m) => m.style.display === "none").length;
      chrome.runtime.sendMessage({
        type: "stats",
        total: messages.length,
        hidden: hidden,
        enabled: enabled,
      }).catch(() => {});
    }
  });

  // --- Init ---

  function init() {
    loadSettings();
    startObserver();
    setInterval(checkNavigation, POLL_INTERVAL);

    // Initial trim after DOM settles
    setTimeout(trim, 1000);
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
