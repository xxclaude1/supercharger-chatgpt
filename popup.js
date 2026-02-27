// Supercharger for ChatGPT — Popup Script

var enabledToggle = document.getElementById("enabled");
var visibleSlider = document.getElementById("visible-count");
var sliderValue = document.getElementById("slider-value");
var optimizedCount = document.getElementById("optimized-count");
var totalCount = document.getElementById("total-count");
var statusMsg = document.getElementById("status-msg");

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
          return;
        }
        if (callback) callback(response);
      });
    }
  });
}

// Update the status message based on stats
function updateStatus(total, hidden, threshold) {
  if (!statusMsg) return;
  if (total === 0) {
    statusMsg.style.display = "block";
    statusMsg.style.color = "#999";
    statusMsg.textContent = "No conversation detected";
  } else if (hidden > 0) {
    statusMsg.style.display = "block";
    statusMsg.style.color = "#10a37f";
    statusMsg.textContent = "Active — " + hidden + " messages hidden for speed";
  } else if (total <= threshold) {
    statusMsg.style.display = "block";
    statusMsg.style.color = "#999";
    statusMsg.textContent = "Standing by — chat has " + total + " messages (threshold: " + threshold + ")";
  } else {
    statusMsg.style.display = "none";
  }
}

// Request stats using sendResponse pattern
function requestStats() {
  var threshold = parseInt(visibleSlider.value, 10) || 50;
  sendToContent({ type: "getStats" }, function (response) {
    if (response && response.type === "stats") {
      optimizedCount.textContent = response.hidden || 0;
      totalCount.textContent = response.total || 0;
      updateStatus(response.total || 0, response.hidden || 0, threshold);
    }
  });
}

// Initial stats request + polling
requestStats();
setInterval(requestStats, 2000);
