/**
 * ChatGPT Turbo – Content Script
 *
 * Hides older messages in long ChatGPT conversations to eliminate browser lag.
 * Messages are hidden with CSS (display:none), never deleted.
 * A "Load more" button lets users reveal older messages on demand.
 */

(function () {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────
  const DEFAULT_VISIBLE_COUNT = 30;
  const POLL_INTERVAL = 2000;
  const LOAD_MORE_BATCH = 20;
  const TRIM_DEBOUNCE_MS = 300;

  let visibleCount = DEFAULT_VISIBLE_COUNT;
  let isEnabled = true;
  let loadMoreButton = null;
  let statusBadge = null;
  let isTrimming = false;
  let trimTimer = null;
  let observer = null;
  let lastUrl = location.href;

  // ─── Load saved settings ──────────────────────────────────────────
  function loadSettings() {
    try {
      const saved = localStorage.getItem('chatgpt-turbo-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.visibleCount) visibleCount = settings.visibleCount;
        if (settings.isEnabled !== undefined) isEnabled = settings.isEnabled;
      }
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem('chatgpt-turbo-settings', JSON.stringify({
        visibleCount: visibleCount,
        isEnabled: isEnabled
      }));
    } catch (e) { /* ignore */ }
  }

  loadSettings();

  // ─── Message selectors (multi-tier fallback) ──────────────────────
  // ChatGPT's DOM can change. We try multiple selectors in order of reliability.

  function getMessageElements() {
    // Tier 1: article elements with data-testid (most reliable, used by all competing extensions)
    var messages = document.querySelectorAll('article[data-testid^="conversation-turn"]');
    if (messages.length > 0) return Array.from(messages);

    // Tier 2: any element with conversation-turn testid (if tag changes from article)
    messages = document.querySelectorAll('[data-testid^="conversation-turn"]');
    if (messages.length > 0) return Array.from(messages);

    // Tier 3: elements with message author role attribute
    messages = document.querySelectorAll('[data-message-author-role]');
    if (messages.length > 0) return Array.from(messages);

    // Tier 4: articles inside main
    messages = document.querySelectorAll('main article');
    if (messages.length > 0) return Array.from(messages);

    return [];
  }

  // ─── Streaming detection ──────────────────────────────────────────
  // Don't trim while ChatGPT is generating a response — it can break the stream.

  function isStreaming() {
    return !!document.querySelector('[data-testid="stop-button"]');
  }

  // ─── Core: trim/hide older messages ──────────────────────────────

  function trimMessages() {
    if (isTrimming) return;
    if (!isEnabled) return;
    if (isStreaming()) return;  // don't touch DOM while streaming

    isTrimming = true;

    try {
      var messages = getMessageElements();
      if (messages.length === 0) {
        isTrimming = false;
        return;
      }

      var totalMessages = messages.length;

      // Not enough messages to trim — show all, clean up UI
      if (totalMessages <= visibleCount) {
        for (var i = 0; i < messages.length; i++) {
          messages[i].classList.remove('chatgpt-turbo-hidden');
        }
        removeLoadMoreButton();
        updateBadge(totalMessages, 0);
        isTrimming = false;
        return;
      }

      var hiddenCount = totalMessages - visibleCount;

      // Hide older messages, show recent ones
      for (var j = 0; j < totalMessages; j++) {
        if (j < hiddenCount) {
          messages[j].classList.add('chatgpt-turbo-hidden');
        } else {
          messages[j].classList.remove('chatgpt-turbo-hidden');
        }
      }

      // Insert load-more button
      if (hiddenCount > 0) {
        ensureLoadMoreButton(hiddenCount, messages);
      } else {
        removeLoadMoreButton();
      }

      updateBadge(totalMessages, hiddenCount);
    } finally {
      isTrimming = false;
    }
  }

  // Debounced trim — called by observer and polling
  function scheduleTrim() {
    if (trimTimer) clearTimeout(trimTimer);
    trimTimer = setTimeout(trimMessages, TRIM_DEBOUNCE_MS);
  }

  // ─── Load More Button ───────────────────────────────────────────

  function ensureLoadMoreButton(hiddenCount, messages) {
    // Find first visible message
    var firstVisible = null;
    for (var i = 0; i < messages.length; i++) {
      if (!messages[i].classList.contains('chatgpt-turbo-hidden')) {
        firstVisible = messages[i];
        break;
      }
    }
    if (!firstVisible || !firstVisible.parentElement) return;

    if (!loadMoreButton) {
      loadMoreButton = document.createElement('button');
      loadMoreButton.className = 'chatgpt-turbo-load-more';
      loadMoreButton.setAttribute('data-turbo-ui', 'true');
      loadMoreButton.addEventListener('click', handleLoadMore);
    }

    var batch = Math.min(hiddenCount, LOAD_MORE_BATCH);
    loadMoreButton.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="transform:rotate(180deg)">' +
      '<path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      'Load ' + batch + ' more messages (' + hiddenCount + ' hidden)';

    // Insert before first visible message if not already there
    var container = firstVisible.parentElement;
    if (!loadMoreButton.parentElement || loadMoreButton.nextElementSibling !== firstVisible) {
      container.insertBefore(loadMoreButton, firstVisible);
    }
  }

  function removeLoadMoreButton() {
    if (loadMoreButton && loadMoreButton.parentElement) {
      loadMoreButton.parentElement.removeChild(loadMoreButton);
    }
    loadMoreButton = null;
  }

  function handleLoadMore() {
    visibleCount += LOAD_MORE_BATCH;
    saveSettings();
    trimMessages();
  }

  // ─── Status Badge ────────────────────────────────────────────────

  function updateBadge(total, hidden) {
    if (!statusBadge) {
      statusBadge = document.createElement('div');
      statusBadge.className = 'chatgpt-turbo-badge';
      statusBadge.setAttribute('data-turbo-ui', 'true');
      document.body.appendChild(statusBadge);
    }

    if (hidden > 0) {
      statusBadge.textContent = '\u26A1 Turbo: ' + hidden + ' trimmed';
      statusBadge.className = 'chatgpt-turbo-badge chatgpt-turbo-badge-active';
      statusBadge.style.display = '';
    } else if (total > 10) {
      statusBadge.textContent = '\u26A1 Turbo: monitoring';
      statusBadge.className = 'chatgpt-turbo-badge chatgpt-turbo-badge-idle';
      statusBadge.style.display = '';
    } else {
      statusBadge.style.display = 'none';
    }
  }

  // ─── Restore all messages (when disabled) ─────────────────────────

  function restoreAll() {
    var messages = getMessageElements();
    for (var i = 0; i < messages.length; i++) {
      messages[i].classList.remove('chatgpt-turbo-hidden');
    }
    removeLoadMoreButton();
    if (statusBadge) statusBadge.style.display = 'none';
  }

  // ─── Listen for messages from popup ─────────────────────────────

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (msg.type === 'GET_STATUS') {
        var messages = getMessageElements();
        var hidden = 0;
        for (var i = 0; i < messages.length; i++) {
          if (messages[i].classList.contains('chatgpt-turbo-hidden')) hidden++;
        }
        sendResponse({
          isEnabled: isEnabled,
          visibleCount: visibleCount,
          totalMessages: messages.length,
          hiddenMessages: hidden
        });
      } else if (msg.type === 'SET_ENABLED') {
        isEnabled = msg.value;
        saveSettings();
        if (!isEnabled) {
          restoreAll();
        } else {
          trimMessages();
        }
        sendResponse({ ok: true });
      } else if (msg.type === 'SET_VISIBLE_COUNT') {
        visibleCount = msg.value;
        saveSettings();
        trimMessages();
        sendResponse({ ok: true });
      }
      return true;  // keep channel open for async sendResponse
    });
  }

  // ─── MutationObserver ────────────────────────────────────────────

  function startObserving() {
    if (observer) observer.disconnect();

    var target = document.querySelector('main') || document.body;

    observer = new MutationObserver(function (mutations) {
      // Skip mutations from our own UI elements
      if (isTrimming) return;

      var hasRelevant = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Ignore changes to our own injected elements
        if (m.target && m.target.getAttribute && m.target.getAttribute('data-turbo-ui') === 'true') continue;
        if (m.target && (m.target.className === 'chatgpt-turbo-badge' ||
            m.target.className === 'chatgpt-turbo-load-more')) continue;

        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
          hasRelevant = true;
          break;
        }
      }

      if (hasRelevant) {
        scheduleTrim();
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  // ─── SPA Navigation Detection ─────────────────────────────────────

  function checkNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Reload settings (don't reset to default — user's choice persists)
      loadSettings();
      removeLoadMoreButton();
      // Wait for new conversation DOM to render
      setTimeout(trimMessages, 800);
    }
  }

  // Intercept pushState for instant SPA detection
  var origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(checkNavigation, 100);
  };
  window.addEventListener('popstate', function () {
    setTimeout(checkNavigation, 100);
  });

  // ─── Initialize ─────────────────────────────────────────────────

  function init() {
    console.log('[ChatGPT Turbo] Loaded. Monitoring for long conversations...');

    // Try initial trim
    trimMessages();

    // Start watching for DOM changes
    startObserving();

    // Polling backup — catches edge cases observer might miss
    setInterval(function () {
      checkNavigation();
      if (isEnabled && !isStreaming()) {
        trimMessages();
      }
    }, POLL_INTERVAL);
  }

  // Wait for page to be ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 500);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 500);
    });
  }

})();
