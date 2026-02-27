// ─── ChatGPT Turbo – Popup Script ───────────────────────────────

const enableToggle = document.getElementById('enableToggle');
const visibleSlider = document.getElementById('visibleSlider');
const visibleValue = document.getElementById('visibleValue');
const totalMessages = document.getElementById('totalMessages');
const hiddenMessages = document.getElementById('hiddenMessages');
const statusDot = document.getElementById('statusDot');

// Get current tab and request status from content script
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const tab = await getActiveTab();
  if (!tab || !tab.url?.includes('chatgpt.com')) {
    totalMessages.textContent = '—';
    hiddenMessages.textContent = '—';
    statusDot.className = 'status-dot off';
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    if (response) {
      enableToggle.checked = response.isEnabled;
      visibleSlider.value = response.visibleCount;
      visibleValue.textContent = response.visibleCount;
      totalMessages.textContent = response.totalMessages;
      hiddenMessages.textContent = response.hiddenMessages;
      statusDot.className = response.isEnabled ? 'status-dot on' : 'status-dot off';
    }
  } catch (e) {
    // Content script not loaded yet
    totalMessages.textContent = '—';
    hiddenMessages.textContent = '—';
    statusDot.className = 'status-dot off';
  }
}

// Toggle enabled/disabled
enableToggle.addEventListener('change', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SET_ENABLED',
      value: enableToggle.checked
    });
    statusDot.className = enableToggle.checked ? 'status-dot on' : 'status-dot off';
    setTimeout(refreshStatus, 300);
  } catch (e) { /* ignore */ }
});

// Visible messages slider
visibleSlider.addEventListener('input', () => {
  visibleValue.textContent = visibleSlider.value;
});

visibleSlider.addEventListener('change', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SET_VISIBLE_COUNT',
      value: parseInt(visibleSlider.value, 10)
    });
    setTimeout(refreshStatus, 300);
  } catch (e) { /* ignore */ }
});

// Initial load
refreshStatus();
