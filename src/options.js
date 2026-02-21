import { buildCaptureRecord, buildFileName } from "./schema.js";
import { t } from "./i18n.js";
import {
  BUBBLE_MENU_ACTIONS,
  BUBBLE_MENU_LAYOUTS,
  BUBBLE_MENU_STYLES,
  DEFAULT_BUBBLE_MENU_ENABLED,
  DEFAULT_BUBBLE_MENU_ORDER,
  DEFAULT_SETTINGS,
  getSettings,
  normalizeBubbleMenuActions,
  normalizeBubbleMenuLayout,
  normalizeBubbleMenuStyle,
  saveSettings
} from "./settings.js";
import {
  clearSavedDirectoryHandle,
  ensureReadWritePermission,
  getSavedDirectoryHandle,
  saveDirectoryHandle,
  writeJsonToDirectory
} from "./storage.js";
import { buildJsonSubdirectories, formatStoredPath } from "./json-paths.js";
import { resolveStorageBackendWrites } from "./storage-backend.js";

const BUBBLE_MENU_ACTION_META = {
  save_content: {
    labelKey: "options_bubble_label_save_content",
    label: "Save content",
    detailKey: "options_bubble_detail_save_content",
    detail: "Save cleaned page content immediately."
  },
  save_content_with_highlight: {
    labelKey: "options_bubble_label_save_with_highlight",
    label: "Save content with highlight",
    detailKey: "options_bubble_detail_save_with_highlight",
    detail: "Save content and include the current selection as a highlight."
  },
  save_content_with_note: {
    labelKey: "options_bubble_label_save_with_note",
    label: "Save content with a note",
    detailKey: "options_bubble_detail_save_with_note",
    detail: "Open note input and save content with your comment."
  },
  highlight: {
    labelKey: "options_bubble_label_highlight",
    label: "Highlight",
    detailKey: "options_bubble_detail_highlight",
    detail: "Queue selected text as a highlight."
  },
  highlight_with_note: {
    labelKey: "options_bubble_label_highlight_with_note",
    label: "Highlight with a note",
    detailKey: "options_bubble_detail_highlight_with_note",
    detail: "Queue selected text and attach a note."
  }
};

/** @type {HTMLDivElement} */
const folderStatus = /** @type {HTMLDivElement} */ (document.getElementById("folderStatus"));
/** @type {HTMLButtonElement} */
const chooseFolderButton = /** @type {HTMLButtonElement} */ (document.getElementById("chooseFolderButton"));
/** @type {HTMLButtonElement} */
const testWriteButton = /** @type {HTMLButtonElement} */ (document.getElementById("testWriteButton"));
/** @type {HTMLButtonElement} */
const clearFolderButton = /** @type {HTMLButtonElement} */ (document.getElementById("clearFolderButton"));
/** @type {HTMLInputElement} */
const storageBackendJson = /** @type {HTMLInputElement} */ (document.getElementById("storageBackendJson"));
/** @type {HTMLInputElement} */
const storageBackendSqlite = /** @type {HTMLInputElement} */ (document.getElementById("storageBackendSqlite"));
/** @type {HTMLInputElement} */
const storageBackendBoth = /** @type {HTMLInputElement} */ (document.getElementById("storageBackendBoth"));
/** @type {HTMLElement} */
const folderOrganizationSection = /** @type {HTMLElement} */ (document.getElementById("folderOrganizationSection"));
/** @type {HTMLElement} */
const largeContentSection = /** @type {HTMLElement} */ (document.getElementById("largeContentSection"));
/** @type {HTMLInputElement} */
const organizeByDateInput = /** @type {HTMLInputElement} */ (document.getElementById("organizeByDateInput"));
/** @type {HTMLInputElement} */
const organizeByTypeInput = /** @type {HTMLInputElement} */ (document.getElementById("organizeByTypeInput"));
/** @type {HTMLSelectElement} */
const organizeOrderSelect = /** @type {HTMLSelectElement} */ (document.getElementById("organizeOrderSelect"));
/** @type {HTMLInputElement} */
const compressLargeTextInput = /** @type {HTMLInputElement} */ (document.getElementById("compressLargeTextInput"));
/** @type {HTMLInputElement} */
const compressionThresholdInput = /** @type {HTMLInputElement} */ (document.getElementById("compressionThresholdInput"));
/** @type {HTMLInputElement} */
const includeJsonChunksInput = /** @type {HTMLInputElement} */ (document.getElementById("includeJsonChunksInput"));
/** @type {HTMLInputElement} */
const includeDiagnosticsInput = /** @type {HTMLInputElement} */ (document.getElementById("includeDiagnosticsInput"));
/** @type {HTMLSelectElement} */
const youtubeTranscriptStorageModeSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById("youtubeTranscriptStorageModeSelect")
);
const bubbleLayoutInputs = /** @type {HTMLInputElement[]} */ (
  [...document.querySelectorAll('input[name="bubbleMenuLayout"]')]
);
const bubbleStyleInputs = /** @type {HTMLInputElement[]} */ (
  [...document.querySelectorAll('input[name="bubbleMenuStyle"]')]
);
/** @type {HTMLUListElement} */
const bubbleMenuList = /** @type {HTMLUListElement} */ (document.getElementById("bubbleMenuList"));
/** @type {HTMLParagraphElement} */
const bubbleMenuHint = /** @type {HTMLParagraphElement} */ (document.getElementById("bubbleMenuHint"));
/** @type {HTMLDivElement} */
const settingsStatusToast = /** @type {HTMLDivElement} */ (document.getElementById("settingsStatusToast"));
/** @type {HTMLUListElement} */
const shortcutList = /** @type {HTMLUListElement} */ (document.getElementById("shortcutList"));
/** @type {HTMLButtonElement} */
const openShortcutsButton = /** @type {HTMLButtonElement} */ (document.getElementById("openShortcutsButton"));

const SHORTCUT_COMMANDS = [
  {
    name: "save-selection",
    label: "Save content",
    fallback: "Ctrl+Shift+D / Shift+Command+D"
  },
  {
    name: "save-selection-with-comment",
    label: "Save content with note",
    fallback: "Ctrl+Shift+C / Shift+Command+C"
  }
];

const bubbleState = {
  order: [...DEFAULT_BUBBLE_MENU_ORDER],
  enabled: [...DEFAULT_BUBBLE_MENU_ENABLED]
};

let dragAction = null;
let dragStartIndex = -1;
let currentDropSlot = null;
let autoSaveTimer = 0;
let toastTimer = 0;

function errorMessage(error, fallback) {
  return error?.message || fallback;
}

function setStatus(text, isError = false) {
  folderStatus.textContent = text;
  folderStatus.classList.toggle("is-error", Boolean(isError));
}

function showSettingsToast(text, isError = false, autoHideMs = 2400) {
  settingsStatusToast.textContent = text;
  settingsStatusToast.hidden = false;
  settingsStatusToast.classList.add("is-visible");
  settingsStatusToast.classList.toggle("is-error", Boolean(isError));

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = 0;
  }

  if (autoHideMs > 0) {
    toastTimer = window.setTimeout(() => {
      settingsStatusToast.classList.remove("is-visible");
      settingsStatusToast.hidden = true;
      toastTimer = 0;
    }, autoHideMs);
  }
}

function isActionEnabled(action) {
  return bubbleState.enabled.includes(action);
}

function clearDropIndicators() {
  const items = bubbleMenuList.querySelectorAll(".bubble-option");
  for (const item of items) {
    item.classList.remove("drop-before");
    item.classList.remove("drop-after");
    item.classList.remove("is-dragging");
  }
  bubbleMenuList.classList.remove("is-sorting");
  currentDropSlot = null;
}

function clearDropTargets() {
  const items = bubbleMenuList.querySelectorAll(".bubble-option");
  for (const item of items) {
    item.classList.remove("drop-before");
    item.classList.remove("drop-after");
  }
}

function setDropTarget(item, mode) {
  clearDropTargets();
  item.classList.toggle("drop-before", mode === "before");
  item.classList.toggle("drop-after", mode === "after");
}

function moveActionToSlot(action, slot) {
  if (!action) {
    return;
  }

  const currentOrder = [...bubbleState.order];
  const actionIndex = currentOrder.indexOf(action);
  if (actionIndex < 0) {
    return;
  }

  currentOrder.splice(actionIndex, 1);
  const insertAt = Math.max(0, Math.min(slot, currentOrder.length));
  currentOrder.splice(insertAt, 0, action);
  bubbleState.order = currentOrder;
}

function getNonDraggedItems() {
  return /** @type {HTMLElement[]} */ (
    [...bubbleMenuList.querySelectorAll(".bubble-option")]
  ).filter((item) => item.dataset.action !== dragAction);
}

function computeDropSlot(clientY) {
  const items = getNonDraggedItems();
  if (!items.length) {
    return 0;
  }

  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      return index;
    }
  }

  return items.length;
}

function updateDropIndicator(slot) {
  clearDropTargets();
  if (slot == null || slot === dragStartIndex) {
    return;
  }

  const items = getNonDraggedItems();
  if (!items.length) {
    return;
  }

  if (slot <= 0) {
    setDropTarget(items[0], "before");
    return;
  }

  if (slot >= items.length) {
    setDropTarget(items[items.length - 1], "after");
    return;
  }

  setDropTarget(items[slot], "before");
}

function handleActionToggle(action, checked) {
  if (!checked) {
    const next = bubbleState.enabled.filter((value) => value !== action);
    if (!next.length) {
      showSettingsToast(t("options_toast_keep_one_action", "At least one bubble action must stay enabled."), true);
      renderBubbleMenuOptions();
      return;
    }
    bubbleState.enabled = next;
  } else if (!bubbleState.enabled.includes(action)) {
    bubbleState.enabled = [...bubbleState.enabled, action];
  }

  updateBubbleHint();
  scheduleAutoSave();
}

function updateBubbleHint() {
  const enabledCount = bubbleState.order.filter((action) => bubbleState.enabled.includes(action)).length;
  bubbleMenuHint.textContent =
    enabledCount === 1
      ? "1 action enabled. Drag to reorder."
      : `${enabledCount} actions enabled. Drag to reorder.`;
}

function renderBubbleMenuOptions() {
  bubbleMenuList.textContent = "";
  for (const action of bubbleState.order) {
    const meta = BUBBLE_MENU_ACTION_META[action] || { label: action, detail: "" };
    const item = document.createElement("li");
    item.className = "bubble-option";
    item.dataset.action = action;
    item.draggable = true;

    const handle = document.createElement("span");
    handle.className = "bubble-option__handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-hidden", "true");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bubble-option__checkbox";
    checkbox.checked = isActionEnabled(action);
    checkbox.id = `bubbleAction-${action}`;

    const copy = document.createElement("label");
    copy.className = "bubble-option__copy";
    copy.htmlFor = checkbox.id;

    const title = document.createElement("span");
    title.className = "bubble-option__title";
    title.textContent = t(meta.labelKey || "", meta.label || action);

    const detail = document.createElement("span");
    detail.className = "bubble-option__detail";
    detail.textContent = t(meta.detailKey || "", meta.detail || "");

    copy.append(title, detail);
    item.append(handle, checkbox, copy);

    checkbox.addEventListener("change", () => {
      handleActionToggle(action, checkbox.checked);
    });

    item.addEventListener("dragstart", (event) => {
      dragAction = action;
      dragStartIndex = bubbleState.order.indexOf(action);
      currentDropSlot = null;
      item.classList.add("is-dragging");
      bubbleMenuList.classList.add("is-sorting");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", action);
        event.dataTransfer.dropEffect = "move";
      }
    });

    item.addEventListener("dragend", () => {
      dragAction = null;
      dragStartIndex = -1;
      clearDropIndicators();
    });

    bubbleMenuList.appendChild(item);
  }

  updateBubbleHint();
}

bubbleMenuList.addEventListener("dragover", (event) => {
  if (!dragAction) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const nextSlot = computeDropSlot(event.clientY);
  if (nextSlot === currentDropSlot) {
    return;
  }
  currentDropSlot = nextSlot;
  updateDropIndicator(nextSlot);
});

bubbleMenuList.addEventListener("drop", (event) => {
  if (!dragAction) {
    return;
  }
  event.preventDefault();
  if (currentDropSlot == null || currentDropSlot === dragStartIndex) {
    dragAction = null;
    dragStartIndex = -1;
    clearDropIndicators();
    return;
  }

  moveActionToSlot(dragAction, currentDropSlot);
  dragAction = null;
  dragStartIndex = -1;
  clearDropIndicators();
  renderBubbleMenuOptions();
  scheduleAutoSave();
});

async function refreshStatus() {
  const handle = await getSavedDirectoryHandle();
  if (!handle) {
    setStatus(t("options_status_no_folder", "No folder selected."), true);
    return;
  }

  const permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission === "granted") {
    setStatus(t("options_status_folder_linked", `Folder linked: ${handle.name}`, handle.name));
    return;
  }

  setStatus(
    t(
      "options_status_folder_permission_needed",
      `Folder linked but permission needed: ${handle.name}`,
      handle.name
    ),
    true
  );
}

async function refreshCaptureSettings() {
  const settings = await getSettings();
  const { storageBackend: backend } = resolveStorageBackendWrites(settings.storageBackend);
  storageBackendJson.checked = backend === "json";
  storageBackendSqlite.checked = backend === "sqlite";
  storageBackendBoth.checked = backend === "both";
  organizeByDateInput.checked = Boolean(settings.organizeByDate);
  organizeByTypeInput.checked = Boolean(settings.organizeByType);
  organizeOrderSelect.value = settings.organizeOrder || "type_date";
  syncStorageBackendUi();
  compressLargeTextInput.checked = Boolean(settings.compressLargeText);
  compressionThresholdInput.value = String(settings.compressionThresholdChars);
  includeJsonChunksInput.checked = Boolean(settings.includeJsonChunks);
  includeDiagnosticsInput.checked = Boolean(settings.includeDiagnostics);
  youtubeTranscriptStorageModeSelect.value = normalizeTranscriptStorageMode(
    settings.youtubeTranscriptStorageMode
  );
  setRadioValue(
    bubbleLayoutInputs,
    normalizeBubbleMenuLayout(settings.bubbleMenuLayout),
    DEFAULT_SETTINGS.bubbleMenuLayout
  );
  setRadioValue(
    bubbleStyleInputs,
    normalizeBubbleMenuStyle(settings.bubbleMenuStyle),
    DEFAULT_SETTINGS.bubbleMenuStyle
  );

  const bubble = normalizeBubbleMenuActions(settings.bubbleMenuOrder, settings.bubbleMenuEnabled);
  bubbleState.order = bubble.order;
  bubbleState.enabled = bubble.enabled;
  renderBubbleMenuOptions();
}

function toggleOrganizationInputs(disabled) {
  organizeByDateInput.disabled = disabled;
  organizeByTypeInput.disabled = disabled;
  organizeOrderSelect.disabled = disabled;
  folderOrganizationSection.hidden = disabled;
}

function toggleLargeContentInputs(disabled) {
  largeContentSection.hidden = disabled;
  compressLargeTextInput.disabled = disabled;
  compressionThresholdInput.disabled = disabled;
  includeJsonChunksInput.disabled = disabled;
}

function updateOrderVisibility() {
  const showOrder =
    hasJsonOutputEnabled() && organizeByDateInput.checked && organizeByTypeInput.checked;
  organizeOrderSelect.disabled = !showOrder;
  const orderField = /** @type {HTMLElement|null} */ (organizeOrderSelect.closest(".field"));
  if (orderField) {
    orderField.hidden = !showOrder;
  }
}

function hasJsonOutputEnabled() {
  return storageBackendJson.checked || storageBackendBoth.checked;
}

function selectedStorageBackend() {
  if (storageBackendBoth.checked) {
    return "both";
  }
  if (storageBackendSqlite.checked) {
    return "sqlite";
  }
  return "json";
}

function syncStorageBackendUi() {
  const useJson = hasJsonOutputEnabled();
  toggleOrganizationInputs(!useJson);
  toggleLargeContentInputs(!useJson);
  updateOrderVisibility();
}

function clampNumber(input, fallback) {
  const value = Number.parseInt(input, 10);
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(1000, value);
}

function normalizeTranscriptStorageMode(value) {
  if (value === "segments" || value === "both") {
    return value;
  }
  return "document_text";
}

function setRadioValue(inputs, value, fallback) {
  const normalized = value || fallback;
  let matched = false;
  for (const input of inputs) {
    const checked = input.value === normalized;
    input.checked = checked;
    matched ||= checked;
  }

  if (!matched && inputs.length > 0) {
    inputs[0].checked = true;
  }
}

function getCheckedRadioValue(inputs, fallback) {
  const selected = inputs.find((input) => input.checked);
  return selected?.value || fallback;
}

async function persistCaptureSettings() {
  const normalizedBubble = normalizeBubbleMenuActions(bubbleState.order, bubbleState.enabled);
  const nextSettings = {
    compressLargeText: compressLargeTextInput.checked,
    compressionThresholdChars: clampNumber(
      compressionThresholdInput.value,
      DEFAULT_SETTINGS.compressionThresholdChars
    ),
    includeJsonChunks: includeJsonChunksInput.checked,
    includeDiagnostics: includeDiagnosticsInput.checked,
    storageBackend: selectedStorageBackend(),
    youtubeTranscriptStorageMode: normalizeTranscriptStorageMode(
      youtubeTranscriptStorageModeSelect.value
    ),
    bubbleMenuLayout: normalizeBubbleMenuLayout(
      getCheckedRadioValue(bubbleLayoutInputs, DEFAULT_SETTINGS.bubbleMenuLayout)
    ),
    bubbleMenuStyle: normalizeBubbleMenuStyle(
      getCheckedRadioValue(bubbleStyleInputs, DEFAULT_SETTINGS.bubbleMenuStyle)
    ),
    organizeByDate: organizeByDateInput.checked,
    organizeByType: organizeByTypeInput.checked,
    organizeOrder: organizeOrderSelect.value === "date_type" ? "date_type" : "type_date",
    bubbleMenuOrder: normalizedBubble.order,
    bubbleMenuEnabled: normalizedBubble.enabled
  };

  await saveSettings(nextSettings);
  showSettingsToast(t("options_toast_settings_saved", "Settings saved."));
}

function scheduleAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = 0;
    persistCaptureSettings().catch((error) => {
      showSettingsToast(`Save failed: ${error?.message || "Unknown error"}`, true, 4200);
    });
  }, 250);
}

function formatShortcutLabel(shortcut) {
  if (!shortcut) {
    return "Not set";
  }
  return shortcut.replace(/\+/g, " + ").replace(/Command/g, "Cmd");
}

function renderShortcutItem(label, shortcut, isMissing = false) {
  const item = document.createElement("li");
  item.className = "shortcut-item";

  const name = document.createElement("span");
  name.className = "shortcut-name";
  name.textContent = label;

  const value = document.createElement("span");
  value.className = "shortcut-value";
  value.textContent = formatShortcutLabel(shortcut);
  if (isMissing) {
    value.classList.add("is-empty");
  }

  item.append(name, value);
  return item;
}

async function getAllCommands() {
  if (!chrome?.commands?.getAll) {
    return [];
  }

  return await new Promise((resolve, reject) => {
    chrome.commands.getAll((commands) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(commands || []);
    });
  });
}

async function refreshShortcutList() {
  shortcutList.textContent = "";

  let commands = [];
  try {
    commands = await getAllCommands();
  } catch (error) {
    shortcutList.appendChild(
      renderShortcutItem("Shortcuts unavailable", error?.message || "Could not load shortcuts.", true)
    );
    return;
  }

  const commandsByName = new Map(commands.map((command) => [command.name, command]));
  for (const definition of SHORTCUT_COMMANDS) {
    const command = commandsByName.get(definition.name);
    const shortcut = command?.shortcut || "";
    const isMissing = !command?.shortcut;
    const label = isMissing ? `${definition.label} (default: ${definition.fallback})` : definition.label;
    shortcutList.appendChild(renderShortcutItem(label, shortcut, isMissing));
  }
}

function openChromeShortcutsPage() {
  const url = "chrome://extensions/shortcuts";
  if (!chrome?.tabs?.create) {
    showSettingsToast("Open chrome://extensions/shortcuts to edit keyboard shortcuts.", true, 4200);
    return;
  }
  chrome.tabs.create({ url }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      showSettingsToast("Open chrome://extensions/shortcuts to edit keyboard shortcuts.", true, 4200);
    }
  });
}

async function chooseFolder() {
  const picker = /** @type {any} */ (window).showDirectoryPicker;
  if (typeof picker !== "function") {
    setStatus("Directory picker is not available in this Chrome version.", true);
    return;
  }

  try {
    const handle = await picker({ mode: "readwrite" });
    const granted = await ensureReadWritePermission(handle);
    if (!granted) {
      setStatus("Folder permission was not granted.", true);
      return;
    }

    await saveDirectoryHandle(handle);
    setStatus(t("options_status_folder_linked", `Folder linked: ${handle.name}`, handle.name));
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    setStatus(`Failed to choose folder: ${error?.message || "Unknown error"}`, true);
  }
}

async function testWrite() {
  try {
    const handle = await getSavedDirectoryHandle();
    if (!handle) {
      setStatus("Select a folder first.", true);
      return;
    }

    const granted = await ensureReadWritePermission(handle);
    if (!granted) {
      setStatus("Folder permission was denied.", true);
      return;
    }

    let record = buildCaptureRecord({
      captureType: "settings_test",
      source: {
        url: chrome.runtime.getURL("src/options.html"),
        title: "Settings Test",
        site: "extension",
        language: "en",
        metadata: {
          note: "Connectivity test file"
        }
      },
      content: {
        documentText: "Settings test write successful.",
        annotations: null,
        transcriptText: null,
        transcriptSegments: null
      }
    });

    const settings = await getSettings();
    const { writesJson, writesSqlite } = resolveStorageBackendWrites(settings.storageBackend);

    if (writesJson && settings.includeJsonChunks) {
      const { buildJsonChunksForRecord } = await import("./sqlite-write.js");
      record.content.chunks = buildJsonChunksForRecord(record);
    }

    let sqliteFileName = null;
    let sqliteError = null;
    if (writesSqlite) {
      try {
        const { saveRecordToSqlite } = await import("./sqlite-write.js");
        sqliteFileName = await saveRecordToSqlite(handle, record);
      } catch (error) {
        sqliteError = error;
      }
    }

    let storedJsonPath = null;
    let jsonError = null;
    if (writesJson) {
      try {
        const fileName = buildFileName(record);
        const subdirectories = buildJsonSubdirectories(record, settings);
        await writeJsonToDirectory(handle, fileName, record, subdirectories);
        storedJsonPath = subdirectories.length ? `${subdirectories.join("/")}/${fileName}` : fileName;
      } catch (error) {
        jsonError = error;
      }
    }

    if (writesJson && writesSqlite) {
      if (jsonError && sqliteError) {
        setStatus(
          `Test write failed: json=${errorMessage(
            jsonError,
            "JSON write failed"
          )}; sqlite=${errorMessage(sqliteError, "SQLite write failed")}`,
          true
        );
        return;
      }
      if (jsonError && sqliteFileName) {
        setStatus(
          `Test record saved to ${sqliteFileName} (JSON failed: ${errorMessage(
            jsonError,
            "JSON write failed"
          )})`,
          true
        );
        return;
      }
      if (sqliteError && storedJsonPath) {
        setStatus(
          `Test record saved to ${storedJsonPath} (SQLite failed: ${errorMessage(
            sqliteError,
            "SQLite write failed"
          )})`,
          true
        );
        return;
      }
      setStatus(`Test record saved to ${storedJsonPath} and ${sqliteFileName}`);
      return;
    }
    if (writesJson) {
      if (jsonError) {
        setStatus(`Test write failed: ${errorMessage(jsonError, "JSON write failed")}`, true);
        return;
      }
      setStatus(`Test file saved: ${storedJsonPath}`);
      return;
    }
    if (sqliteError) {
      setStatus(`Test write failed: ${errorMessage(sqliteError, "SQLite write failed")}`, true);
      return;
    }
    setStatus(`Test record saved to ${sqliteFileName}`);
  } catch (error) {
    setStatus(`Test write failed: ${error?.message || "Unknown error"}`, true);
  }
}

async function clearFolder() {
  await clearSavedDirectoryHandle();
  setStatus("Folder selection cleared.", true);
}

chooseFolderButton.addEventListener("click", () => {
  chooseFolder().catch((error) => setStatus(error?.message || "Failed", true));
});

testWriteButton.addEventListener("click", () => {
  testWrite().catch((error) => setStatus(error?.message || "Failed", true));
});

clearFolderButton.addEventListener("click", () => {
  clearFolder().catch((error) => setStatus(error?.message || "Failed", true));
});

storageBackendJson.addEventListener("change", () => {
  syncStorageBackendUi();
  scheduleAutoSave();
});
storageBackendSqlite.addEventListener("change", () => {
  syncStorageBackendUi();
  scheduleAutoSave();
});
storageBackendBoth.addEventListener("change", () => {
  syncStorageBackendUi();
  scheduleAutoSave();
});
organizeByDateInput.addEventListener("change", () => {
  updateOrderVisibility();
  scheduleAutoSave();
});
organizeByTypeInput.addEventListener("change", () => {
  updateOrderVisibility();
  scheduleAutoSave();
});
organizeOrderSelect.addEventListener("change", scheduleAutoSave);
compressLargeTextInput.addEventListener("change", scheduleAutoSave);
compressionThresholdInput.addEventListener("input", scheduleAutoSave);
compressionThresholdInput.addEventListener("change", scheduleAutoSave);
includeJsonChunksInput.addEventListener("change", scheduleAutoSave);
includeDiagnosticsInput.addEventListener("change", scheduleAutoSave);
youtubeTranscriptStorageModeSelect.addEventListener("change", scheduleAutoSave);
for (const input of bubbleLayoutInputs) {
  input.addEventListener("change", scheduleAutoSave);
}
for (const input of bubbleStyleInputs) {
  input.addEventListener("change", scheduleAutoSave);
}
openShortcutsButton.addEventListener("click", openChromeShortcutsPage);
window.addEventListener("focus", () => {
  refreshShortcutList().catch(() => {});
});

refreshStatus().catch((error) => setStatus(error?.message || "Failed", true));
refreshCaptureSettings()
  .catch((error) => showSettingsToast(error?.message || "Failed", true, 4200));
refreshShortcutList().catch((error) => showSettingsToast(error?.message || "Failed", true, 4200));
