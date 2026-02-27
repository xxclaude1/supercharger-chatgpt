// ─── ChatGPT Turbo – Popup Script ───────────────────────────────

var enableToggle = document.getElementById('enableToggle');
var visibleSlider = document.getElementById('visibleSlider');
var visibleValue = document.getElementById('visibleValue');
var totalMessagesEl = document.getElementById('totalMessages');
var hiddenMessagesEl = document.getElementById('hiddenMessages');
var statusDot = document.getElementById('statusDot');

// Get the active tab
function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    callback(tabs && tabs[0] ? tabs[0] : null);
  });
}

// Check if tab is on ChatGPT
function isChatGPTTab(tab) {
  if (!tab || !tab.url) return false;
  return tab.url.indexOf('chatgpt.com') !== -1 || tab.url.indexOf('chat.openai.com') !== -1;
}

// Refresh stats from content script
function refreshStatus() {
  getActiveTab(function (tab) {
    if (!tab || !isChatGPTTab(tab)) {
      totalMessagesEl.textContent = '\u2014';
      hiddenMessagesEl.textContent = '\u2014';
      statusDot.className = 'status-dot off';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, function (response) {
      if (chrome.runtime.lastError || !response) {
        totalMessagesEl.textContent = '\u2014';
        hiddenMessagesEl.textContent = '\u2014';
        statusDot.className = 'status-dot off';
        return;
      }

      enableToggle.checked = response.isEnabled;
      visibleSlider.value = response.visibleCount;
      visibleValue.textContent = response.visibleCount;
      totalMessagesEl.textContent = response.totalMessages;
      hiddenMessagesEl.textContent = response.hiddenMessages;
      statusDot.className = response.isEnabled ? 'status-dot on' : 'status-dot off';
    });
  });
}

// Toggle enabled/disabled
enableToggle.addEventListener('change', function () {
  getActiveTab(function (tab) {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, {
      type: 'SET_ENABLED',
      value: enableToggle.checked
    }, function () {
      if (chrome.runtime.lastError) return;
      statusDot.className = enableToggle.checked ? 'status-dot on' : 'status-dot off';
      setTimeout(refreshStatus, 300);
    });
  });
});

// Visible messages slider — update label on input, send on change
visibleSlider.addEventListener('input', function () {
  visibleValue.textContent = visibleSlider.value;
});

visibleSlider.addEventListener('change', function () {
  getActiveTab(function (tab) {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, {
      type: 'SET_VISIBLE_COUNT',
      value: parseInt(visibleSlider.value, 10)
    }, function () {
      if (chrome.runtime.lastError) return;
      setTimeout(refreshStatus, 300);
    });
  });
});

// Initial load + polling
refreshStatus();
setInterval(refreshStatus, 2000);
