/**
 * ChatGPT Turbo – Content Script
 * Hides older messages to eliminate lag in long ChatGPT conversations.
 */

(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────
  var VISIBLE_COUNT = 5;
  var LOAD_MORE_BATCH = 20;
  var loadMoreBtn = null;
  var badge = null;
  var isEnabled = true;
  var isTrimming = false;

  // ─── STEP 1: Find messages using every known selector ─────────────
  function findMessages() {
    var selectors = [
      'article[data-testid^="conversation-turn"]',
      '[data-testid^="conversation-turn-"]',
      '[data-testid^="conversation-turn"]',
      'main article[data-message-author-role]',
      '[data-message-author-role]',
      'main article',
    ];

    for (var s = 0; s < selectors.length; s++) {
      var found = document.querySelectorAll(selectors[s]);
      if (found.length > 0) {
        console.log('[Turbo] Using selector: "' + selectors[s] + '" — found ' + found.length + ' messages');
        return Array.from(found);
      }
    }

    console.log('[Turbo] WARNING: No messages found with any selector');
    return [];
  }

  // ─── STEP 2: Check if ChatGPT is streaming a response ────────────
  function isStreaming() {
    return !!document.querySelector('[data-testid="stop-button"]');
  }

  // ─── STEP 3: Core trim — hide old messages, show recent ones ──────
  function trim() {
    if (isTrimming || !isEnabled || isStreaming()) return;
    isTrimming = true;

    try {
      var msgs = findMessages();
      var total = msgs.length;
      if (total === 0) return;

      // Load saved visible count
      try {
        var saved = localStorage.getItem('turbo-visible');
        if (saved) VISIBLE_COUNT = parseInt(saved, 10) || 5;
      } catch (e) {}

      if (total <= VISIBLE_COUNT) {
        // Not enough to trim — make sure everything is visible
        for (var i = 0; i < msgs.length; i++) {
          msgs[i].classList.remove('chatgpt-turbo-hidden');
        }
        removeBanner();
        updateBadge(total, 0);
        return;
      }

      // Hide older, show newer
      var hideCount = total - VISIBLE_COUNT;
      for (var j = 0; j < total; j++) {
        if (j < hideCount) {
          msgs[j].classList.add('chatgpt-turbo-hidden');
        } else {
          msgs[j].classList.remove('chatgpt-turbo-hidden');
        }
      }

      console.log('[Turbo] Trimmed: hiding ' + hideCount + ' of ' + total + ' messages');
      showLoadMore(hideCount, msgs);
      updateBadge(total, hideCount);
    } finally {
      isTrimming = false;
    }
  }

  // ─── STEP 4: "Load more" button ──────────────────────────────────
  function showLoadMore(hiddenCount, msgs) {
    // Find first visible message
    var firstVisible = null;
    for (var i = 0; i < msgs.length; i++) {
      if (!msgs[i].classList.contains('chatgpt-turbo-hidden')) {
        firstVisible = msgs[i];
        break;
      }
    }
    if (!firstVisible || !firstVisible.parentElement) return;

    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'chatgpt-turbo-load-more';
      loadMoreBtn.setAttribute('data-turbo', '1');
      loadMoreBtn.onclick = function () {
        VISIBLE_COUNT += LOAD_MORE_BATCH;
        try { localStorage.setItem('turbo-visible', String(VISIBLE_COUNT)); } catch (e) {}
        trim();
      };
    }

    var batch = Math.min(hiddenCount, LOAD_MORE_BATCH);
    loadMoreBtn.innerHTML =
      '\u2B06\uFE0F Load ' + batch + ' more messages (' + hiddenCount + ' hidden)';

    if (!loadMoreBtn.parentElement) {
      firstVisible.parentElement.insertBefore(loadMoreBtn, firstVisible);
    }
  }

  function removeBanner() {
    if (loadMoreBtn && loadMoreBtn.parentElement) {
      loadMoreBtn.remove();
    }
    loadMoreBtn = null;
  }

  // ─── STEP 5: Floating status badge ───────────────────────────────
  function updateBadge(total, hidden) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'chatgpt-turbo-badge';
      badge.setAttribute('data-turbo', '1');
      document.body.appendChild(badge);
    }

    if (hidden > 0) {
      badge.textContent = '\u26A1 Turbo: ' + hidden + ' trimmed';
      badge.className = 'chatgpt-turbo-badge chatgpt-turbo-badge-active';
      badge.style.display = '';
    } else if (total > 3) {
      badge.textContent = '\u26A1 Turbo: monitoring (' + total + ' msgs)';
      badge.className = 'chatgpt-turbo-badge chatgpt-turbo-badge-idle';
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // ─── STEP 6: Restore all (when disabled) ─────────────────────────
  function restoreAll() {
    var msgs = findMessages();
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].classList.remove('chatgpt-turbo-hidden');
    }
    removeBanner();
    if (badge) badge.style.display = 'none';
  }

  // ─── STEP 7: Listen for popup messages ───────────────────────────
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (msg.type === 'GET_STATUS') {
        var msgs = findMessages();
        var hidden = 0;
        for (var i = 0; i < msgs.length; i++) {
          if (msgs[i].classList.contains('chatgpt-turbo-hidden')) hidden++;
        }
        sendResponse({
          isEnabled: isEnabled,
          visibleCount: VISIBLE_COUNT,
          totalMessages: msgs.length,
          hiddenMessages: hidden
        });
      } else if (msg.type === 'SET_ENABLED') {
        isEnabled = msg.value;
        if (!isEnabled) { restoreAll(); } else { trim(); }
        sendResponse({ ok: true });
      } else if (msg.type === 'SET_VISIBLE_COUNT') {
        VISIBLE_COUNT = msg.value;
        try { localStorage.setItem('turbo-visible', String(VISIBLE_COUNT)); } catch (e) {}
        trim();
        sendResponse({ ok: true });
      }
      return true;
    });
  } catch (e) {
    console.log('[Turbo] chrome.runtime not available:', e);
  }

  // ─── STEP 8: Watch for new messages (MutationObserver) ───────────
  function startWatching() {
    var target = document.querySelector('main') || document.body;
    var observer = new MutationObserver(function (mutations) {
      if (isTrimming) return;
      for (var i = 0; i < mutations.length; i++) {
        var t = mutations[i].target;
        if (t && t.getAttribute && t.getAttribute('data-turbo') === '1') continue;
        if (mutations[i].addedNodes.length > 0) {
          setTimeout(trim, 300);
          return;
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  // ─── STEP 9: Handle SPA navigation ──────────────────────────────
  var lastUrl = location.href;
  var origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    setTimeout(onNav, 200);
  };
  window.addEventListener('popstate', function () { setTimeout(onNav, 200); });

  function onNav() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('[Turbo] Navigation detected:', location.href);
      removeBanner();
      setTimeout(trim, 1000);
    }
  }

  // ─── STEP 10: Boot ───────────────────────────────────────────────
  function boot() {
    console.log('[Turbo] ===== ChatGPT Turbo loaded =====');
    console.log('[Turbo] URL:', location.href);
    console.log('[Turbo] Visible count:', VISIBLE_COUNT);

    // Try immediately
    var msgs = findMessages();
    console.log('[Turbo] Initial message count:', msgs.length);

    if (msgs.length > 0) {
      trim();
      startWatching();
    } else {
      // Messages haven't loaded yet — wait and retry
      console.log('[Turbo] No messages yet, waiting...');
      var retries = 0;
      var interval = setInterval(function () {
        retries++;
        var m = findMessages();
        console.log('[Turbo] Retry #' + retries + ': found ' + m.length + ' messages');
        if (m.length > 0) {
          clearInterval(interval);
          trim();
          startWatching();
        }
        if (retries > 20) {
          console.log('[Turbo] Gave up looking for messages after 20 retries');
          clearInterval(interval);
          startWatching(); // still watch for when they appear
        }
      }, 500);
    }

    // Backup poll every 3 seconds
    setInterval(function () {
      if (isEnabled && !isStreaming() && !isTrimming) {
        onNav();
        trim();
      }
    }, 3000);
  }

  // Start when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

})();
