// Supercharger for ChatGPT — Popup Script

const enabledToggle = document.getElementById("enabled");
const visibleSlider = document.getElementById("visible-count");
const sliderValue = document.getElementById("slider-value");
const optimizedCount = document.getElementById("optimized-count");
const totalCount = document.getElementById("total-count");

// Load saved settings
chrome.storage.local.get(["enabled", "visibleCount"], function (result) {
  if (result.enabled !== undefined) enabledToggle.checked = result.enabled;
  if (result.visibleCount !== undefined) {
    visibleSlider.value = result.visibleCount;
    sliderValue.textContent = result.visibleCount;
  }
});

// Toggle handler
enabledToggle.addEventListener("change", function () {
  var val = enabledToggle.checked;
  chrome.storage.local.set({ enabled: val });
  sendToContent({ type: "settingsChanged", enabled: val });
});

// Slider handler
var sliderDebounce = null;
visibleSlider.addEventListener("input", function () {
  var val = parseInt(visibleSlider.value, 10);
  sliderValue.textContent = val;

  // Debounce storage writes and messages while sliding
  if (sliderDebounce) clearTimeout(sliderDebounce);
  sliderDebounce = setTimeout(function () {
    chrome.storage.local.set({ visibleCount: val });
    sendToContent({ type: "settingsChanged", visibleCount: val });
  }, 150);
});

// Send message to content script on the active ChatGPT tab
function sendToContent(msg, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, msg, function (response) {
        if (chrome.runtime.lastError) {
          // Content script not ready or not on ChatGPT
          return;
        }
        if (callback) callback(response);
      });
    }
  });
}

// Request stats using sendResponse pattern (no runtime.onMessage needed)
function requestStats() {
  sendToContent({ type: "getStats" }, function (response) {
    if (response && response.type === "stats") {
      optimizedCount.textContent = response.hidden || 0;
      totalCount.textContent = response.total || 0;
    }
  });
}

// Initial stats request + polling
requestStats();
setInterval(requestStats, 2000);
