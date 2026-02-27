/**
 * ChatGPT Turbo – Content Script
 * 
 * Core idea: ChatGPT renders every message in the DOM. In long conversations
 * (100+ messages), this causes massive lag because the browser must layout/paint
 * thousands of DOM nodes. 
 * 
 * Solution: We hide older messages by collapsing them (display:none), keeping only
 * the N most recent visible. A "Load more" button lets users reveal older messages
 * on demand. All messages remain in the DOM — we never delete anything.
 * 
 * How ChatGPT's DOM works (as of early 2026):
 * - The main conversation container holds article elements (or divs with data-message-id)
 * - Each message turn is typically an <article> or a div inside the scrollable area
 * - We target the conversation thread container and its direct children
 */

(function () {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────
  const DEFAULT_VISIBLE_COUNT = 30;  // messages to keep visible
  const POLL_INTERVAL = 1500;        // ms between DOM checks
  const LOAD_MORE_BATCH = 20;        // messages to reveal per click

  let visibleCount = DEFAULT_VISIBLE_COUNT;
  let isEnabled = true;
  let loadMoreButton = null;
  let statusBadge = null;
  let lastMessageCount = 0;

  // Load saved settings
  try {
    const saved = localStorage.getItem('chatgpt-turbo-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      visibleCount = settings.visibleCount || DEFAULT_VISIBLE_COUNT;
      isEnabled = settings.isEnabled !== undefined ? settings.isEnabled : true;
    }
  } catch (e) { /* ignore */ }

  // ─── Utility: find the conversation message container ────────────
  function getConversationContainer() {
    // ChatGPT uses a scrollable div containing article elements for each message
    // Strategy: find all <article> elements, their common parent is the container
    const articles = document.querySelectorAll('article[data-testid^="conversation-turn"]');
    if (articles.length > 0) {
      return articles[0].parentElement;
    }

    // Fallback: look for the main thread container by role
    const main = document.querySelector('main');
    if (!main) return null;

    // The conversation is usually inside a div with overflow-y auto/scroll
    const scrollables = main.querySelectorAll('div[class]');
    for (const el of scrollables) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.children.length > 5
      ) {
        // Check if children look like message containers
        const firstChild = el.children[0];
        if (firstChild && (firstChild.tagName === 'ARTICLE' || firstChild.querySelector('article'))) {
          return el;
        }
      }
    }

    return null;
  }

  // ─── Get all message elements ────────────────────────────────────
  function getMessageElements() {
    // Primary: article elements with conversation turn test IDs
    let messages = document.querySelectorAll('article[data-testid^="conversation-turn"]');
    if (messages.length > 0) return Array.from(messages);

    // Fallback: articles inside main
    messages = document.querySelectorAll('main article');
    if (messages.length > 0) return Array.from(messages);

    // Last resort: direct children of the conversation container
    const container = getConversationContainer();
    if (container) {
      return Array.from(container.children).filter(
        el => el.tagName !== 'BUTTON' && !el.classList.contains('chatgpt-turbo-load-more')
      );
    }

    return [];
  }

  // ─── Core: trim/hide older messages ──────────────────────────────
  function trimMessages() {
    if (!isEnabled) return;

    const messages = getMessageElements();
    if (messages.length === 0) return;

    const totalMessages = messages.length;

    // Only act if there are more messages than our visible threshold
    if (totalMessages <= visibleCount) {
      // Show all, remove load-more button if present
      messages.forEach(msg => {
        msg.style.display = '';
        msg.classList.remove('chatgpt-turbo-hidden');
      });
      removeLoadMoreButton();
      updateBadge(totalMessages, 0);
      lastMessageCount = totalMessages;
      return;
    }

    const hiddenCount = totalMessages - visibleCount;
    let hiddenActual = 0;

    messages.forEach((msg, index) => {
      if (index < hiddenCount) {
        if (!msg.classList.contains('chatgpt-turbo-hidden')) {
          msg.style.display = 'none';
          msg.classList.add('chatgpt-turbo-hidden');
        }
        hiddenActual++;
      } else {
        if (msg.classList.contains('chatgpt-turbo-hidden')) {
          msg.style.display = '';
          msg.classList.remove('chatgpt-turbo-hidden');
        }
      }
    });

    // Add or update "Load more" button
    if (hiddenActual > 0) {
      ensureLoadMoreButton(hiddenActual);
    } else {
      removeLoadMoreButton();
    }

    updateBadge(totalMessages, hiddenActual);
    lastMessageCount = totalMessages;
  }

  // ─── Load More Button ───────────────────────────────────────────
  function ensureLoadMoreButton(hiddenCount) {
    const messages = getMessageElements();
    if (messages.length === 0) return;

    // Find the first visible message to insert before it
    const firstVisible = messages.find(m => !m.classList.contains('chatgpt-turbo-hidden'));
    if (!firstVisible) return;

    if (!loadMoreButton) {
      loadMoreButton = document.createElement('button');
      loadMoreButton.className = 'chatgpt-turbo-load-more';
      loadMoreButton.addEventListener('click', handleLoadMore);
    }

    loadMoreButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="transform:rotate(180deg)">
        <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Load ${Math.min(hiddenCount, LOAD_MORE_BATCH)} more messages (${hiddenCount} hidden)
    `;

    // Insert before first visible message
    if (loadMoreButton.parentElement !== firstVisible.parentElement) {
      firstVisible.parentElement.insertBefore(loadMoreButton, firstVisible);
    } else if (loadMoreButton.nextElementSibling !== firstVisible) {
      firstVisible.parentElement.insertBefore(loadMoreButton, firstVisible);
    }
  }

  function removeLoadMoreButton() {
    if (loadMoreButton && loadMoreButton.parentElement) {
      loadMoreButton.parentElement.removeChild(loadMoreButton);
    }
    loadMoreButton = null;
  }

  function handleLoadMore() {
    // Increase visible count to show more messages
    visibleCount += LOAD_MORE_BATCH;
    saveSettings();
    trimMessages();
  }

  // ─── Status Badge (floating indicator) ──────────────────────────
  function updateBadge(total, hidden) {
    if (!statusBadge) {
      statusBadge = document.createElement('div');
      statusBadge.className = 'chatgpt-turbo-badge';
      document.body.appendChild(statusBadge);
    }

    if (hidden > 0) {
      statusBadge.innerHTML = `⚡ Turbo: ${hidden} trimmed`;
      statusBadge.classList.add('chatgpt-turbo-badge-active');
      statusBadge.classList.remove('chatgpt-turbo-badge-idle');
    } else if (total > 10) {
      statusBadge.innerHTML = `⚡ Turbo: monitoring`;
      statusBadge.classList.remove('chatgpt-turbo-badge-active');
      statusBadge.classList.add('chatgpt-turbo-badge-idle');
    } else {
      statusBadge.style.display = 'none';
      return;
    }
    statusBadge.style.display = '';
  }

  // ─── Settings Persistence ───────────────────────────────────────
  function saveSettings() {
    try {
      localStorage.setItem('chatgpt-turbo-settings', JSON.stringify({
        visibleCount,
        isEnabled
      }));
    } catch (e) { /* ignore */ }
  }

  // ─── Listen for messages from popup ─────────────────────────────
  chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATUS') {
      const messages = getMessageElements();
      const hidden = messages.filter(m => m.classList.contains('chatgpt-turbo-hidden')).length;
      sendResponse({
        isEnabled,
        visibleCount,
        totalMessages: messages.length,
        hiddenMessages: hidden
      });
    } else if (msg.type === 'SET_ENABLED') {
      isEnabled = msg.value;
      if (!isEnabled) {
        // Show all messages
        getMessageElements().forEach(m => {
          m.style.display = '';
          m.classList.remove('chatgpt-turbo-hidden');
        });
        removeLoadMoreButton();
        if (statusBadge) statusBadge.style.display = 'none';
      } else {
        trimMessages();
      }
      saveSettings();
      sendResponse({ ok: true });
    } else if (msg.type === 'SET_VISIBLE_COUNT') {
      visibleCount = msg.value;
      saveSettings();
      trimMessages();
      sendResponse({ ok: true });
    }
    return true;
  });

  // ─── Observe DOM for new messages & navigation ──────────────────
  let observer = null;

  function startObserving() {
    const target = document.querySelector('main') || document.body;

    observer = new MutationObserver((mutations) => {
      // Debounce: only run trim if new nodes were added
      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        requestAnimationFrame(trimMessages);
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  // ─── Handle ChatGPT SPA navigation ─────────────────────────────
  // ChatGPT is a SPA — when user switches conversations, we need to reset
  let lastUrl = location.href;

  function checkNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Reset visible count on conversation switch
      visibleCount = DEFAULT_VISIBLE_COUNT;
      lastMessageCount = 0;
      removeLoadMoreButton();
      // Small delay to let new conversation DOM render
      setTimeout(trimMessages, 500);
    }
  }

  // ─── Initialize ─────────────────────────────────────────────────
  function init() {
    console.log('[ChatGPT Turbo] Extension loaded. Monitoring for long conversations...');

    // Initial trim
    trimMessages();

    // Start observing DOM changes
    startObserving();

    // Poll as backup (handles edge cases the observer might miss)
    setInterval(() => {
      checkNavigation();
      trimMessages();
    }, POLL_INTERVAL);
  }

  // Wait for page to be ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  }

})();
