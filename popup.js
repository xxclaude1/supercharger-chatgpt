// Supercharger for ChatGPT — Popup Script

const enabledToggle = document.getElementById("enabled");
const visibleSlider = document.getElementById("visible-count");
const sliderValue = document.getElementById("slider-value");
const optimizedCount = document.getElementById("optimized-count");
const totalCount = document.getElementById("total-count");

// Load saved settings
chrome.storage.local.get(["enabled", "visibleCount"], (result) => {
  if (result.enabled !== undefined) enabledToggle.checked = result.enabled;
  if (result.visibleCount !== undefined) {
    visibleSlider.value = result.visibleCount;
    sliderValue.textContent = result.visibleCount;
  }
});

// Toggle handler
enabledToggle.addEventListener("change", () => {
  const val = enabledToggle.checked;
  chrome.storage.local.set({ enabled: val });
  sendToContent({ type: "settingsChanged", enabled: val });
});

// Slider handler
visibleSlider.addEventListener("input", () => {
  const val = parseInt(visibleSlider.value, 10);
  sliderValue.textContent = val;
  chrome.storage.local.set({ visibleCount: val });
  sendToContent({ type: "settingsChanged", visibleCount: val });
});

// Send message to content script on active tab
function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
    }
  });
}

// Request stats from content script
function requestStats() {
  sendToContent({ type: "getStats" });
}

// Listen for stats from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "stats") {
    optimizedCount.textContent = msg.hidden || 0;
    totalCount.textContent = msg.total || 0;
  }
});

// Poll for stats
requestStats();
setInterval(requestStats, 2000);
