const statusLine = document.getElementById("statusLine");
const saveSelectionButton = document.getElementById("saveSelectionButton");
const saveTranscriptButton = document.getElementById("saveTranscriptButton");
const openSettingsButton = document.getElementById("openSettingsButton");
const shortcutHint = document.getElementById("shortcutHint");

if (!navigator.userAgent.includes("Mac")) {
  shortcutHint.textContent = "Shortcuts: Ctrl+Shift+D, Ctrl+Shift+C";
}

function formatStatus(status) {
  if (!status) {
    return "No captures yet.";
  }

  const time = new Date(status.timestamp).toLocaleString();
  if (status.ok) {
    return `Last capture OK (${status.kind}) at ${time}${status.fileName ? `\n${status.fileName}` : ""}`;
  }

  return `Last capture failed (${status.kind}) at ${time}\n${status.error || "Unknown error"}`;
}

async function refreshStatus() {
  const response = await chrome.runtime.sendMessage({ type: "GET_LAST_CAPTURE_STATUS" });
  statusLine.textContent = formatStatus(response?.status || null);
}

async function runCapture(kind) {
  statusLine.textContent = "Running capture...";
  const response = await chrome.runtime.sendMessage({ type: "RUN_CAPTURE", kind });
  if (!response?.ok) {
    statusLine.textContent = `Capture failed: ${response?.error || "Unknown error"}`;
    return;
  }

  statusLine.textContent = `Saved: ${response.fileName}`;
}

saveSelectionButton.addEventListener("click", () => {
  runCapture("selection").catch((error) => {
    statusLine.textContent = error?.message || "Capture failed";
  });
});

saveTranscriptButton.addEventListener("click", () => {
  runCapture("youtube_transcript").catch((error) => {
    statusLine.textContent = error?.message || "Capture failed";
  });
});

openSettingsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshStatus().catch((error) => {
  statusLine.textContent = error?.message || "Failed to load status";
});
