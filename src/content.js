function normalizeText(value) {
  return (value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getMetaContent(selector) {
  /** @type {HTMLMetaElement|null} */
  const node = document.querySelector(selector);
  return node?.content?.trim() || null;
}

function isYouTubePage() {
  const host = window.location.hostname || "";
  return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
}

function isPdfPage() {
  const type = (document.contentType || "").toLowerCase();
  if (type.includes("pdf")) {
    return true;
  }
  return /\.pdf([?#]|$)/i.test(window.location.href);
}

function getMetaByName(name) {
  return getMetaContent(`meta[name="${name}"]`);
}

function getMetaByProperty(property) {
  return getMetaContent(`meta[property="${property}"]`);
}

function getAllMetaByProperty(property) {
  return Array.from(document.querySelectorAll(`meta[property="${property}"]`))
    .map((node) => /** @type {HTMLMetaElement} */ (node)?.content?.trim())
    .filter(Boolean);
}

function parseJsonLdPublishedDate() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const raw = script.textContent?.trim();
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (stack.length > 0) {
        const item = stack.pop();
        if (!item || typeof item !== "object") {
          continue;
        }

        if (item.datePublished) {
          return String(item.datePublished);
        }

        if (item.uploadDate) {
          return String(item.uploadDate);
        }

        if (Array.isArray(item["@graph"])) {
          stack.push(...item["@graph"]);
        }
      }
    } catch (_err) {
      continue;
    }
  }

  return null;
}

function getPublishedAt() {
  const candidates = [
    getMetaContent('meta[property="article:published_time"]'),
    getMetaContent('meta[name="article:published_time"]'),
    getMetaContent('meta[name="pubdate"]'),
    getMetaContent('meta[name="publish-date"]'),
    getMetaContent('meta[itemprop="datePublished"]'),
    parseJsonLdPublishedDate(),
    document.querySelector("time[datetime]")?.getAttribute("datetime") || null
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function deriveTitleFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const fileParam = parsed.searchParams.get("file");
    const candidate = fileParam ? decodeURIComponent(fileParam) : rawUrl;
    const inner = new URL(candidate, rawUrl);
    const segment = inner.pathname.split("/").filter(Boolean).pop();
    return segment || inner.hostname || null;
  } catch (_error) {
    return null;
  }
}

function getPageMetadata() {
  /** @type {HTMLLinkElement|null} */
  const canonicalNode = document.querySelector('link[rel="canonical"]');
  /** @type {HTMLLinkElement|null} */
  const ampNode = document.querySelector('link[rel="amphtml"]');
  /** @type {HTMLLinkElement|null} */
  const iconNode = document.querySelector('link[rel="icon"]');
  /** @type {HTMLLinkElement|null} */
  const shortcutIconNode = document.querySelector('link[rel="shortcut icon"]');

  const canonicalUrl = canonicalNode?.href || null;
  const ampUrl = ampNode?.href || null;
  const favicon =
    iconNode?.href ||
    shortcutIconNode?.href ||
    null;

  const description =
    getMetaByName("description") ||
    getMetaByProperty("og:description") ||
    getMetaByName("twitter:description");

  const author = getMetaByName("author") || getMetaByProperty("article:author");
  const keywordsRaw = getMetaByName("keywords");
  const ogTitle = getMetaByProperty("og:title");
  const siteName = getMetaByProperty("og:site_name");
  const twitterTitle = getMetaByName("twitter:title");
  const articlePublishedTime = getMetaByProperty("article:published_time");
  const articleModifiedTime = getMetaByProperty("article:modified_time");
  const articleSection = getMetaByProperty("article:section");
  const articleTags = getAllMetaByProperty("article:tag");
  const contentLanguage = getMetaContent('meta[http-equiv="content-language"]');
  const resolvedTitle =
    (document.title && document.title.trim()) ||
    ogTitle ||
    twitterTitle ||
    deriveTitleFromUrl(window.location.href) ||
    "Untitled";

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : null;

  return {
    url: window.location.href,
    title: resolvedTitle,
    site: window.location.hostname || null,
    language: document.documentElement.lang || null,
    publishedAt: getPublishedAt(),
    metadata: {
      canonicalUrl,
      description,
      author,
      keywords,
      siteName,
      articlePublishedTime,
      articleModifiedTime,
      articleSection,
      articleTags: articleTags.length ? articleTags : null,
      contentLanguage,
      documentContentType: document.contentType || null
    }
  };
}

function getDocumentText() {
  return normalizeText(document.body?.innerText || "");
}

const TOAST_STYLE_ID = "ccs-toast-style";
const TOAST_ID = "ccs-toast";
const COMMENT_STYLE_ID = "ccs-comment-style";
const COMMENT_OVERLAY_ID = "ccs-comment-overlay";
const NOTES_PANEL_ID = "ccs-notes-panel";
const NOTES_COUNT_ID = "ccs-notes-count";
const SELECTION_BUBBLE_ID = "ccs-selection-bubble";

function ensureToastStyles() {
  if (document.getElementById(TOAST_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    .ccs-toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      max-width: 360px;
      background: #152238;
      color: #f8fafc;
      border-radius: 12px;
      padding: 12px 14px;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.28);
      font: 13px/1.4 "Segoe UI", Arial, sans-serif;
      z-index: 2147483647;
      display: grid;
      gap: 6px;
    }

    .ccs-toast__title {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.2px;
    }

    .ccs-toast__detail {
      color: #d5dfef;
      font-size: 12px;
      word-break: break-word;
      white-space: pre-wrap;
    }
  `;
  document.head?.appendChild(style);
}

function showSaveToast({ captureType, title, annotationCount, lastAnnotation, fileName }) {
  ensureToastStyles();

  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = "ccs-toast";

  const titleEl = document.createElement("div");
  titleEl.className = "ccs-toast__title";
  titleEl.textContent =
    captureType === "youtube_transcript" ? "Saved YouTube transcript" : "Saved page content";

  const detailEl = document.createElement("div");
  detailEl.className = "ccs-toast__detail";

  const lines = [];
  if (title) {
    lines.push(`Title: ${title}`);
  }

  if (captureType === "youtube_transcript") {
    lines.push("Transcript extracted from this page.");
  } else if (annotationCount && annotationCount > 0) {
    lines.push(`Highlights: ${annotationCount}`);
    if (lastAnnotation?.selectedText) {
      const preview = lastAnnotation.selectedText.trim().replace(/\s+/g, " ").slice(0, 160);
      lines.push(`Selected: "${preview}${lastAnnotation.selectedText.trim().length > 160 ? "..." : ""}"`);
    }
    if (lastAnnotation?.comment) {
      lines.push(
        `Note: "${lastAnnotation.comment.trim().slice(0, 120)}${
          lastAnnotation.comment.trim().length > 120 ? "..." : ""
        }"`
      );
    }
  } else {
    lines.push("No highlights. Saved full page content.");
  }

  if (fileName) {
    lines.push(`File: ${fileName}`);
  }

  detailEl.textContent = lines.join("\n");

  toast.append(titleEl, detailEl);
  document.body?.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function showProgressToast({ title, detail }) {
  ensureToastStyles();

  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = "ccs-toast";
  toast.style.background = "#1d2f4f";

  const titleEl = document.createElement("div");
  titleEl.className = "ccs-toast__title";
  titleEl.textContent = title || "Capturing...";

  const detailEl = document.createElement("div");
  detailEl.className = "ccs-toast__detail";
  detailEl.textContent = detail || "Working...";

  toast.append(titleEl, detailEl);
  document.body?.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

function showErrorToast(message) {
  ensureToastStyles();

  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = "ccs-toast";
  toast.style.background = "#5f1b1b";

  const titleEl = document.createElement("div");
  titleEl.className = "ccs-toast__title";
  titleEl.textContent = "Capture failed";

  const detailEl = document.createElement("div");
  detailEl.className = "ccs-toast__detail";
  detailEl.textContent = message || "Unknown error";

  toast.append(titleEl, detailEl);
  document.body?.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3600);
}

function showInfoToast({ title, detail }) {
  ensureToastStyles();

  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = "ccs-toast";
  toast.style.background = "#1c3b2b";

  const titleEl = document.createElement("div");
  titleEl.className = "ccs-toast__title";
  titleEl.textContent = title || "Info";

  const detailEl = document.createElement("div");
  detailEl.className = "ccs-toast__detail";
  detailEl.textContent = detail || "";

  toast.append(titleEl, detailEl);
  document.body?.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

function ensureCommentStyles() {
  if (document.getElementById(COMMENT_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = COMMENT_STYLE_ID;
  style.textContent = `
    .ccs-comment-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 16, 28, 0.58);
      display: grid;
      place-items: center;
      z-index: 2147483647;
      font: 14px/1.4 "Segoe UI", Arial, sans-serif;
    }

    .ccs-comment-panel {
      width: min(420px, calc(100vw - 32px));
      background: #f8fafc;
      color: #0f172a;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.28);
      display: grid;
      gap: 10px;
    }

    .ccs-comment-panel h2 {
      margin: 0;
      font-size: 16px;
    }

    .ccs-comment-panel p {
      margin: 0;
      color: #475569;
      font-size: 12px;
    }

    .ccs-comment-panel textarea {
      width: 100%;
      min-height: 110px;
      border: 1px solid #cbd5f5;
      border-radius: 10px;
      padding: 10px;
      font: inherit;
      resize: vertical;
    }

    .ccs-comment-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .ccs-comment-actions button {
      border: 0;
      border-radius: 10px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .ccs-comment-actions .primary {
      background: #1d4ed8;
      color: #fff;
    }

    .ccs-comment-actions .ghost {
      background: #e2e8f0;
      color: #0f172a;
    }

    .ccs-notes-panel {
      position: fixed;
      right: 18px;
      bottom: 88px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 14px;
      padding: 12px 14px;
      display: grid;
      gap: 8px;
      font: 13px/1.4 "Segoe UI", Arial, sans-serif;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
      z-index: 2147483646;
    }

    .ccs-notes-panel__count {
      font-weight: 700;
      font-size: 13px;
    }

    .ccs-notes-panel__actions {
      display: flex;
      gap: 8px;
    }

    .ccs-notes-panel__actions button {
      border: 0;
      border-radius: 10px;
      padding: 8px 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .ccs-notes-panel__actions .primary {
      background: #38bdf8;
      color: #0f172a;
    }

    .ccs-selection-bubble {
      position: fixed;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 999px;
      padding: 6px 10px;
      display: flex;
      gap: 8px;
      align-items: center;
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
      font: 12px/1 "Segoe UI", Arial, sans-serif;
      z-index: 2147483646;
      transform: translate(-50%, -100%);
      pointer-events: auto;
    }

    .ccs-selection-bubble button {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 999px;
    }

    .ccs-selection-bubble button:hover {
      background: rgba(255, 255, 255, 0.12);
    }
  `;
  document.head?.appendChild(style);
}

function ensureNotesPanel() {
  let panel = document.getElementById(NOTES_PANEL_ID);
  if (panel) {
    return panel;
  }

  ensureCommentStyles();

  panel = document.createElement("div");
  panel.id = NOTES_PANEL_ID;
  panel.className = "ccs-notes-panel";

  const count = document.createElement("div");
  count.id = NOTES_COUNT_ID;
  count.className = "ccs-notes-panel__count";
  count.textContent = "Highlights ready";

  const actions = document.createElement("div");
  actions.className = "ccs-notes-panel__actions";

  const saveButton = document.createElement("button");
  saveButton.className = "primary";
  saveButton.type = "button";
  saveButton.textContent = "Save";

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    try {
      const response = await chrome.runtime.sendMessage({ type: "RUN_CAPTURE", kind: "selection" });
      if (!response?.ok) {
        showErrorToast(response?.error || "Capture failed");
      }
    } catch (error) {
      showErrorToast(error?.message || "Capture failed");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    }
  });

  actions.append(saveButton);
  panel.append(count, actions);
  document.body?.appendChild(panel);
  return panel;
}

function updateNotesPanel(count) {
  if (!count || count <= 0) {
    const panel = document.getElementById(NOTES_PANEL_ID);
    panel?.remove();
    return;
  }

  const panel = ensureNotesPanel();
  const countEl = document.getElementById(NOTES_COUNT_ID);
  if (countEl) {
    countEl.textContent = `${count} highlight${count === 1 ? "" : "s"} ready`;
  }
  panel.style.display = "grid";
}

function clearNotesPanel() {
  const panel = document.getElementById(NOTES_PANEL_ID);
  panel?.remove();
}

function ensureSelectionBubble() {
  let bubble = document.getElementById(SELECTION_BUBBLE_ID);
  if (bubble) {
    return bubble;
  }

  ensureCommentStyles();

  bubble = document.createElement("div");
  bubble.id = SELECTION_BUBBLE_ID;
  bubble.className = "ccs-selection-bubble";

  const addNoteButton = document.createElement("button");
  addNoteButton.type = "button";
  addNoteButton.textContent = "Add highlight";

  const addCommentButton = document.createElement("button");
  addCommentButton.type = "button";
  addCommentButton.textContent = "Add highlight and note";

  bubble.append(addNoteButton, addCommentButton);
  bubble.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  addNoteButton.addEventListener("click", async () => {
    const text = bubble.dataset.selectionText || "";
    if (!text.trim()) {
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ADD_NOTE",
        selectedText: text,
        comment: null
      });
      if (response?.ok) {
        updateNotesPanel(response.count || 0);
        showInfoToast({ title: "Highlight added", detail: "Selection queued for saving." });
      } else {
        showErrorToast(response?.error || "Failed to add note");
      }
    } catch (error) {
      showErrorToast(error?.message || "Failed to add note");
    } finally {
      bubble.remove();
    }
  });

  addCommentButton.addEventListener("click", async () => {
    const text = bubble.dataset.selectionText || "";
    if (!text.trim()) {
      return;
    }
    const comment = await requestComment();
    if (comment === null) {
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ADD_NOTE",
        selectedText: text,
        comment
      });
      if (response?.ok) {
        updateNotesPanel(response.count || 0);
        showInfoToast({ title: "Highlight added", detail: "Note queued for saving." });
      } else {
        showErrorToast(response?.error || "Failed to add note");
      }
    } catch (error) {
      showErrorToast(error?.message || "Failed to add note");
    } finally {
      bubble.remove();
    }
  });

  document.body?.appendChild(bubble);
  return bubble;
}

function hideSelectionBubble() {
  const bubble = document.getElementById(SELECTION_BUBBLE_ID);
  bubble?.remove();
}

let selectionBubbleTimer = null;
const lastPointerPosition = { x: 0, y: 0, has: false };
const lastClipboardSelection = { text: "", at: 0 };

async function getClipboardSelection() {
  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      return "";
    }
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return normalizeText(text || "");
    }
  } catch (_error) {
    return "";
  }
  return "";
}

function scheduleSelectionBubbleUpdate() {
  if (isYouTubePage()) {
    hideSelectionBubble();
    return;
  }
  if (selectionBubbleTimer) {
    window.clearTimeout(selectionBubbleTimer);
  }

  selectionBubbleTimer = window.setTimeout(() => {
    void (async () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (isPdfPage()) {
        const clipboardText =
          Date.now() - lastClipboardSelection.at < 1500 ? lastClipboardSelection.text : "";
        if (clipboardText) {
          const bubble = ensureSelectionBubble();
          bubble.dataset.selectionText = clipboardText;
          const left = lastPointerPosition.has
            ? Math.min(Math.max(lastPointerPosition.x, 16), window.innerWidth - 16)
            : Math.min(window.innerWidth - 24, Math.max(window.innerWidth / 2, 16));
          const top = lastPointerPosition.has
            ? Math.min(Math.max(lastPointerPosition.y, 24), window.innerHeight - 24)
            : Math.min(window.innerHeight - 24, Math.max(window.innerHeight / 2, 24));
          bubble.style.left = `${left}px`;
          bubble.style.top = `${top}px`;
          return;
        }
      }
      hideSelectionBubble();
      return;
    }
    let anchor = selection.anchorNode;
    if (anchor && anchor.nodeType === Node.TEXT_NODE) {
      anchor = anchor.parentElement;
    }
    if (anchor instanceof HTMLElement) {
      const inOverlay = anchor.closest(`#${COMMENT_OVERLAY_ID}`);
      const inNotes = anchor.closest(`#${NOTES_PANEL_ID}`);
      if (inOverlay || inNotes) {
        hideSelectionBubble();
        return;
      }
    }
    const text = normalizeText(selection.toString() || "");
    if (!text) {
      if (isPdfPage()) {
        const clipboardText =
          Date.now() - lastClipboardSelection.at < 1500 ? lastClipboardSelection.text : "";
        if (clipboardText) {
          const bubble = ensureSelectionBubble();
          bubble.dataset.selectionText = clipboardText;
          const left = lastPointerPosition.has
            ? Math.min(Math.max(lastPointerPosition.x, 16), window.innerWidth - 16)
            : Math.min(window.innerWidth - 24, Math.max(window.innerWidth / 2, 16));
          const top = lastPointerPosition.has
            ? Math.min(Math.max(lastPointerPosition.y, 24), window.innerHeight - 24)
            : Math.min(window.innerHeight - 24, Math.max(window.innerHeight / 2, 24));
          bubble.style.left = `${left}px`;
          bubble.style.top = `${top}px`;
          return;
        }
      }
      hideSelectionBubble();
      return;
    }
    if (!selection.rangeCount) {
      hideSelectionBubble();
      return;
    }

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      const rects = range.getClientRects();
      if (rects.length) {
        rect = rects[0];
      }
    }
    if (!rect || (!rect.width && !rect.height)) {
      hideSelectionBubble();
      return;
    }

    const bubble = ensureSelectionBubble();
    bubble.dataset.selectionText = text;

    const left = Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16);
    const top = Math.max(rect.top - 8, 16);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    })();
  }, 80);
}

function requestComment() {
  return new Promise((resolve) => {
    const existing = document.getElementById(COMMENT_OVERLAY_ID);
    if (existing) {
      existing.remove();
    }

    ensureCommentStyles();

    const overlay = document.createElement("div");
    overlay.id = COMMENT_OVERLAY_ID;
    overlay.className = "ccs-comment-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const panel = document.createElement("div");
    panel.className = "ccs-comment-panel";

    const heading = document.createElement("h2");
    heading.textContent = "Add a note";

    const hint = document.createElement("p");
    hint.textContent = "Your note will be saved alongside this capture.";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Optional note about this content";

    const actions = document.createElement("div");
    actions.className = "ccs-comment-actions";

    const cancelButton = document.createElement("button");
    cancelButton.className = "ghost";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    const saveButton = document.createElement("button");
    saveButton.className = "primary";
    saveButton.type = "button";
    saveButton.textContent = "Save";

    actions.append(cancelButton, saveButton);
    panel.append(heading, hint, textarea, actions);
    overlay.append(panel);
    document.body?.appendChild(overlay);

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancelButton.addEventListener("click", () => cleanup(null));
    saveButton.addEventListener("click", () => cleanup(textarea.value.trim()));
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(null);
      }

      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        cleanup(textarea.value.trim());
      }
    });

    textarea.focus();
  });
}

function captureSelection() {
  const selection = normalizeText(window.getSelection()?.toString() || "");
  const page = getPageMetadata();
  const isPdf =
    (document.contentType || "").toLowerCase().includes("pdf") ||
    /\.pdf([?#]|$)/i.test(window.location.href);
  return {
    ok: true,
    type: "selected_text",
    isPdf,
    selectedText: selection,
    documentText: isPdf ? null : getDocumentText(),
    source: {
      ...page,
      metadata: {
        ...page.metadata,
        selectionLength: selection.length
      }
    },
    diagnostics: {
      missingFields: page.publishedAt ? [] : ["publishedAt"]
    }
  };
}

document.addEventListener("selectionchange", scheduleSelectionBubbleUpdate);
document.addEventListener("mouseup", async (event) => {
  lastPointerPosition.x = event.clientX;
  lastPointerPosition.y = event.clientY;
  lastPointerPosition.has = true;
  if (isPdfPage()) {
    const clipboardText = await getClipboardSelection();
    if (clipboardText) {
      lastClipboardSelection.text = clipboardText;
      lastClipboardSelection.at = Date.now();
    }
  }
  scheduleSelectionBubbleUpdate();
});
document.addEventListener("keyup", scheduleSelectionBubbleUpdate);
window.addEventListener(
  "scroll",
  () => {
    hideSelectionBubble();
  },
  true
);

function getYouTubeVideoId() {
  const url = new URL(window.location.href);
  if (url.pathname.startsWith("/watch")) {
    return url.searchParams.get("v");
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/")[2] || null;
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extractBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaping = false;
  let start = -1;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === "\\") {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function findJsonInText(text, marker) {
  let idx = text.indexOf(marker);
  while (idx !== -1) {
    const start = text.indexOf("{", idx);
    if (start === -1) {
      return null;
    }
    const jsonText = extractBalancedJson(text, start);
    if (!jsonText) {
      return null;
    }
    try {
      return JSON.parse(jsonText);
    } catch (_error) {
      idx = text.indexOf(marker, idx + marker.length);
    }
  }
  return null;
}

function findPlayerResponseInScripts() {
  const scripts = Array.from(document.scripts || []);
  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text.includes("ytInitialPlayerResponse")) {
      continue;
    }
    const parsed = findJsonInText(text, "ytInitialPlayerResponse");
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

async function fetchPlayerResponseFromHtml() {
  try {
    const response = await fetch(window.location.href, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return findJsonInText(text, "ytInitialPlayerResponse");
  } catch (_error) {
    return null;
  }
}

async function getPlayerResponseFromMainWorld() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_YT_PLAYER_RESPONSE" });
    if (response?.ok && response.playerResponse) {
      return response.playerResponse;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

async function getPlayerResponse() {
  const fromMain = await getPlayerResponseFromMainWorld();
  if (fromMain) {
    return fromMain;
  }

  const fromScripts = findPlayerResponseInScripts();
  if (fromScripts) {
    return fromScripts;
  }
  return fetchPlayerResponseFromHtml();
}

function getCaptionTracks(playerResponse) {
  const captions =
    playerResponse?.captions?.playerCaptionsTracklistRenderer ||
    playerResponse?.captions?.playerCaptionsRenderer ||
    playerResponse?.playerCaptionsTracklistRenderer ||
    playerResponse?.playerCaptionsRenderer ||
    null;
  return captions?.captionTracks || null;
}

function isAutoGeneratedTrack(track) {
  if (!track) {
    return false;
  }
  if (track.kind === "asr") {
    return true;
  }
  const label = track.name?.simpleText || track.name?.runs?.map((run) => run?.text).join("") || "";
  return /auto-generated|auto generated|automatically/i.test(label);
}

function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const language = (navigator.language || "").split("-")[0];
  if (language) {
    const exact = tracks.find(
      (track) =>
        track.languageCode?.toLowerCase().startsWith(language.toLowerCase()) &&
        !isAutoGeneratedTrack(track)
    );
    if (exact) {
      return exact;
    }
  }

  const nonAuto = tracks.find((track) => !isAutoGeneratedTrack(track));
  return nonAuto || tracks[0];
}

async function fetchTimedTextTracks(videoId) {
  if (!videoId) {
    return null;
  }
  try {
    const url = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    if (!text || !text.includes("<track")) {
      return null;
    }
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const tracks = Array.from(doc.querySelectorAll("track")).map((track) => ({
      lang: track.getAttribute("lang_code"),
      kind: track.getAttribute("kind"),
      name: track.getAttribute("name"),
      langOriginal: track.getAttribute("lang_original"),
      langTranslated: track.getAttribute("lang_translated")
    }));
    return tracks.filter((track) => track.lang);
  } catch (_error) {
    return null;
  }
}

function pickTimedTextTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const language = (navigator.language || "").split("-")[0];
  if (language) {
    const exact = tracks.find(
      (track) =>
        track.lang?.toLowerCase().startsWith(language.toLowerCase()) && track.kind !== "asr"
    );
    if (exact) {
      return exact;
    }
  }

  const nonAuto = tracks.find((track) => track.kind !== "asr");
  return nonAuto || tracks[0];
}

async function fetchTranscriptViaTimedText(videoId) {
  const tracks = await fetchTimedTextTracks(videoId);
  const track = pickTimedTextTrack(tracks);
  if (!track?.lang) {
    return null;
  }

  const params = new URLSearchParams({
    v: videoId,
    lang: track.lang,
    fmt: "json3"
  });
  if (track.kind) {
    params.set("kind", track.kind);
  }

  try {
    const response = await fetch(`https://www.youtube.com/api/timedtext?${params.toString()}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const segments = events
      .map((event) => {
        const text = normalizeText(
          (event?.segs || []).map((seg) => seg?.utf8 || "").join("")
        );
        if (!text) {
          return null;
        }
        return {
          timestamp: formatTimestamp(Number(event?.tStartMs || 0)),
          text
        };
      })
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    return {
      segments,
      transcriptText: segments.map((segment) => segment.text).join("\n"),
      track
    };
  } catch (_error) {
    return null;
  }
}

async function fetchTranscriptFromTrack(track) {
  if (!track?.baseUrl) {
    return null;
  }
  let url = track.baseUrl;
  if (!/[?&]fmt=/.test(url)) {
    url += `${url.includes("?") ? "&" : "?"}fmt=json3`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const segments = events
      .map((event) => {
        const text = normalizeText(
          (event?.segs || []).map((seg) => seg?.utf8 || "").join("")
        );
        if (!text) {
          return null;
        }
        return {
          timestamp: formatTimestamp(Number(event?.tStartMs || 0)),
          text
        };
      })
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    return {
      segments,
      transcriptText: segments.map((segment) => segment.text).join("\n")
    };
  } catch (_error) {
    return null;
  }
}

async function fetchTranscriptViaApi() {
  const playerResponse = await getPlayerResponse();
  if (playerResponse) {
    const tracks = getCaptionTracks(playerResponse);
    const track = pickCaptionTrack(tracks);
    if (track) {
      const transcript = await fetchTranscriptFromTrack(track);
      if (transcript) {
        return {
          ...transcript,
          track,
          source: "api"
        };
      }
    }
  }

  return null;
}

async function tryOpenTranscriptPanel() {
  const existingRows = document.querySelectorAll("ytd-transcript-segment-renderer");
  if (existingRows.length > 0) {
    return true;
  }

  const directTranscriptButton = Array.from(
    document.querySelectorAll(
      'button, tp-yt-paper-item, ytd-button-renderer, ytd-menu-service-item-renderer'
    )
  ).find((el) => /transcript/i.test(el.textContent || ""));

  if (directTranscriptButton) {
    /** @type {HTMLElement} */ (directTranscriptButton).click();
    for (let i = 0; i < 20; i += 1) {
      await sleep(250);
      if (document.querySelectorAll("ytd-transcript-segment-renderer").length > 0) {
        return true;
      }
    }
  }

  /** @type {HTMLElement|null} */
  const menuButton =
    document.querySelector('ytd-menu-renderer button[aria-label*="More actions" i]') ||
    document.querySelector('button[aria-label*="more actions" i]');

  if (!menuButton) {
    return false;
  }

  menuButton.click();
  await sleep(250);

  const menuItems = Array.from(
    document.querySelectorAll("tp-yt-paper-item, ytd-menu-service-item-renderer")
  );
  const transcriptItem = menuItems.find((item) => /show transcript/i.test(item.textContent || ""));

  if (!transcriptItem) {
    /** @type {HTMLElement|null} */
    const dismiss = document.querySelector("tp-yt-iron-dropdown[opened] tp-yt-paper-item");
    dismiss?.click();
    return false;
  }

  /** @type {HTMLElement} */ (transcriptItem).click();

  for (let i = 0; i < 20; i += 1) {
    await sleep(250);
    if (document.querySelectorAll("ytd-transcript-segment-renderer").length > 0) {
      return true;
    }
  }

  return false;
}

function extractTranscriptSegments() {
  const rows = Array.from(document.querySelectorAll("ytd-transcript-segment-renderer"));

  return rows
    .map((row) => {
      const timestamp =
        row.querySelector(".segment-timestamp")?.textContent?.trim() ||
        row.querySelector("#segment-timestamp")?.textContent?.trim() ||
        row.querySelector("yt-formatted-string.segment-timestamp")?.textContent?.trim() ||
        null;

      const text =
        row.querySelector(".segment-text")?.textContent?.trim() ||
        row.querySelector("#segment-text")?.textContent?.trim() ||
        row.querySelector("yt-formatted-string.segment-text")?.textContent?.trim() ||
        null;

      if (!text) {
        return null;
      }

      return { timestamp, text };
    })
    .filter(Boolean);
}

async function captureYouTubeTranscript() {
  const page = getPageMetadata();
  const videoId = getYouTubeVideoId();

  const opened = await tryOpenTranscriptPanel();
  let segments = extractTranscriptSegments();
  let transcriptText = segments.map((item) => item.text).join("\n");
  let transcriptSource = "dom";
  let transcriptTrack = null;

  if (segments.length === 0) {
    const apiResult = await fetchTranscriptViaApi();
    if (apiResult) {
      segments = apiResult.segments;
      transcriptText = apiResult.transcriptText;
      transcriptSource = apiResult.source || "api";
      transcriptTrack = apiResult.track;
    } else if (videoId) {
      const timedTextResult = await fetchTranscriptViaTimedText(videoId);
      if (timedTextResult) {
        segments = timedTextResult.segments;
        transcriptText = timedTextResult.transcriptText;
        transcriptSource = "timedtext";
        transcriptTrack = timedTextResult.track;
      }
    }
  }

  const transcriptUnavailable = segments.length === 0;
  const missingFields = [];
  if (!page.publishedAt) {
    missingFields.push("publishedAt");
  }
  if (transcriptUnavailable) {
    missingFields.push("transcript");
  }

  return {
    ok: true,
    type: "youtube_transcript",
    selectedText: null,
    documentText: transcriptText || "",
    transcriptText: transcriptText || null,
    transcriptSegments: segments,
    source: {
      ...page,
      metadata: {
        ...page.metadata,
        videoId,
        transcriptStatus: transcriptUnavailable ? "transcript_unavailable" : "transcript_available",
        transcriptSource,
        transcriptLanguage: transcriptTrack?.languageCode || transcriptTrack?.lang || null,
        transcriptIsAutoGenerated: transcriptTrack ? isAutoGeneratedTrack(transcriptTrack) : null
      }
    },
    diagnostics: {
      missingFields,
      transcriptOpenedByExtension: opened,
      transcriptSource,
      reason: transcriptUnavailable
        ? "Transcript panel unavailable or no transcript rows found."
        : null
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_SELECTION") {
    sendResponse(captureSelection());
    return;
  }

  if (message?.type === "CAPTURE_SELECTION_WITH_COMMENT") {
    const snapshot = captureSelection();
    requestComment()
      .then((comment) => {
        if (comment === null) {
          sendResponse({ ok: false, error: "Comment cancelled" });
          return;
        }

        sendResponse({
          ...snapshot,
          comment
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error?.message || "Failed to capture note"
        });
      });
    return true;
  }

  if (message?.type === "CAPTURE_YOUTUBE_TRANSCRIPT") {
    captureYouTubeTranscript()
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error?.message || "Failed to capture YouTube transcript"
        });
      });
    return true;
  }

  if (message?.type === "CAPTURE_YOUTUBE_TRANSCRIPT_WITH_COMMENT") {
    requestComment()
      .then((comment) => {
        if (comment === null) {
          sendResponse({ ok: false, error: "Comment cancelled" });
          return;
        }

        return captureYouTubeTranscript().then((result) => {
          sendResponse({
            ...result,
            comment
          });
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error?.message || "Failed to capture transcript"
        });
      });
    return true;
  }

  if (message?.type === "SHOW_SAVE_TOAST") {
    showSaveToast(message.payload || {});
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "SHOW_PROGRESS_TOAST") {
    showProgressToast(message.payload || {});
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "SHOW_ERROR_TOAST") {
    showErrorToast(message.payload?.message || "Capture failed");
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "SHOW_INFO_TOAST") {
    showInfoToast(message.payload || {});
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "NOTES_UPDATED") {
    if (isYouTubePage()) {
      clearNotesPanel();
      sendResponse({ ok: true });
      return;
    }
    updateNotesPanel(Number(message.payload?.count || 0));
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "CLEAR_PENDING_NOTES") {
    clearNotesPanel();
    sendResponse({ ok: true });
    return;
  }

  sendResponse({ ok: false, error: "Unknown message type" });
});
