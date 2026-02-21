import {
  BUBBLE_MENU_ACTIONS,
  BUBBLE_MENU_LAYOUTS,
  BUBBLE_MENU_STYLES,
  DEFAULT_BUBBLE_MENU_LAYOUT,
  DEFAULT_BUBBLE_MENU_STYLE,
  DEFAULT_BUBBLE_MENU_ENABLED,
  DEFAULT_BUBBLE_MENU_ORDER,
  normalizeBubbleMenuActions,
  normalizeBubbleMenuLayout,
  normalizeBubbleMenuStyle
} from "./bubble-settings.js";
import { STORAGE_BACKENDS, normalizeStorageBackend } from "./storage-backend.js";
import { LOG_LEVELS, normalizeLogLevel } from "./logger.js";

export {
  BUBBLE_MENU_ACTIONS,
  BUBBLE_MENU_LAYOUTS,
  BUBBLE_MENU_STYLES,
  DEFAULT_BUBBLE_MENU_LAYOUT,
  DEFAULT_BUBBLE_MENU_STYLE,
  DEFAULT_BUBBLE_MENU_ENABLED,
  DEFAULT_BUBBLE_MENU_ORDER,
  normalizeBubbleMenuActions,
  normalizeBubbleMenuLayout,
  normalizeBubbleMenuStyle,
  STORAGE_BACKENDS,
  LOG_LEVELS,
  normalizeLogLevel
};

export const DEFAULT_SETTINGS = {
  maxDocumentChars: 0,
  compressLargeText: false,
  compressionThresholdChars: 75000,
  includeJsonChunks: false,
  includeDiagnostics: false,
  logLevel: "error",
  storageBackend: "json",
  youtubeTranscriptStorageMode: "document_text",
  organizeByDate: false,
  organizeByType: false,
  organizeOrder: "type_date",
  bubbleMenuLayout: DEFAULT_BUBBLE_MENU_LAYOUT,
  bubbleMenuStyle: DEFAULT_BUBBLE_MENU_STYLE,
  bubbleMenuOrder: [...DEFAULT_BUBBLE_MENU_ORDER],
  bubbleMenuEnabled: [...DEFAULT_BUBBLE_MENU_ENABLED]
};

const SETTINGS_KEY = "captureSettings";
const STATUS_KEY = "lastCaptureStatus";

function normalizeBubbleSettings(input) {
  const normalized = normalizeBubbleMenuActions(input?.bubbleMenuOrder, input?.bubbleMenuEnabled);

  return {
    bubbleMenuOrder: normalized.order,
    bubbleMenuEnabled: normalized.enabled
  };
}

function normalizeSettings(input) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(input || {})
  };
  const storageBackend = normalizeStorageBackend(
    merged.storageBackend,
    DEFAULT_SETTINGS.storageBackend
  );
  const bubble = normalizeBubbleSettings(merged);
  const bubbleMenuLayout = normalizeBubbleMenuLayout(
    merged.bubbleMenuLayout,
    DEFAULT_SETTINGS.bubbleMenuLayout
  );
  const bubbleMenuStyle = normalizeBubbleMenuStyle(
    merged.bubbleMenuStyle,
    DEFAULT_SETTINGS.bubbleMenuStyle
  );
  return {
    ...merged,
    storageBackend,
    includeJsonChunks: merged.includeJsonChunks === true,
    includeDiagnostics: merged.includeDiagnostics === true,
    logLevel: normalizeLogLevel(merged.logLevel, DEFAULT_SETTINGS.logLevel),
    bubbleMenuLayout,
    bubbleMenuStyle,
    bubbleMenuOrder: bubble.bubbleMenuOrder,
    bubbleMenuEnabled: bubble.bubbleMenuEnabled
  };
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const value = result?.[SETTINGS_KEY] || {};
  return normalizeSettings(value);
}

export async function saveSettings(input) {
  const next = normalizeSettings(input);

  await chrome.storage.local.set({
    [SETTINGS_KEY]: next
  });

  return next;
}

export async function getLastCaptureStatus() {
  const result = await chrome.storage.local.get(STATUS_KEY);
  return result?.[STATUS_KEY] || null;
}

export async function setLastCaptureStatus(status) {
  await chrome.storage.local.set({
    [STATUS_KEY]: {
      ...status,
      timestamp: new Date().toISOString()
    }
  });
}
