import {
  MAX_ANNOTATION_COMMENT_CHARS,
  MAX_ANNOTATION_TEXT_CHARS
} from "./annotation-policy.js";

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isSentenceTerminatorChar(char) {
  return /[.!?。！？]/.test(char || "");
}

function findSentenceStart(text, fromIndex) {
  for (let index = Math.max(0, fromIndex - 1); index >= 0; index -= 1) {
    if (!isSentenceTerminatorChar(text[index])) {
      continue;
    }
    let start = index + 1;
    while (start < text.length && /[\s"'“”‘’)\]]/.test(text[start])) {
      start += 1;
    }
    return start;
  }
  return 0;
}

function findSentenceEnd(text, fromIndex) {
  for (let index = Math.max(0, fromIndex); index < text.length; index += 1) {
    if (!isSentenceTerminatorChar(text[index])) {
      continue;
    }
    let end = index + 1;
    while (end < text.length && /["'“”‘’)\]]/.test(text[end])) {
      end += 1;
    }
    return end;
  }
  return text.length;
}

function findSelectionBounds(documentText, selectedText) {
  const start = documentText.indexOf(selectedText);
  if (start >= 0) {
    return {
      start,
      end: start + selectedText.length
    };
  }

  const lowerDocument = documentText.toLowerCase();
  const lowerSelection = selectedText.toLowerCase();
  const lowerStart = lowerDocument.indexOf(lowerSelection);
  if (lowerStart >= 0) {
    return {
      start: lowerStart,
      end: lowerStart + selectedText.length
    };
  }

  const tokens = selectedText
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (tokens.length < 2) {
    return null;
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  let cursor = lowerDocument.indexOf(first.toLowerCase());
  while (cursor >= 0) {
    const tail = lowerDocument.indexOf(last.toLowerCase(), cursor + first.length);
    if (tail < 0) {
      break;
    }
    if (tail - cursor <= Math.max(600, selectedText.length * 4)) {
      return {
        start: cursor,
        end: tail + last.length
      };
    }
    cursor = lowerDocument.indexOf(first.toLowerCase(), cursor + 1);
  }

  return null;
}

function expandSelectionToFullSentences(selectedText, documentText) {
  const normalizedSelection = normalizeWhitespace(selectedText || "");
  if (!normalizedSelection) {
    return "";
  }

  const normalizedDocument = normalizeWhitespace(documentText || "");
  if (!normalizedDocument) {
    return normalizedSelection;
  }

  const bounds = findSelectionBounds(normalizedDocument, normalizedSelection);
  if (!bounds) {
    return normalizedSelection;
  }

  const start = findSentenceStart(normalizedDocument, bounds.start);
  const end = findSentenceEnd(normalizedDocument, bounds.end);
  const expanded = normalizeWhitespace(normalizedDocument.slice(start, end));
  return expanded || normalizedSelection;
}

export function normalizeAnnotation(selectedText, comment, options = {}) {
  const expandedText = expandSelectionToFullSentences(selectedText || "", options.documentText || "");
  const normalizedText = expandedText.trim().slice(0, MAX_ANNOTATION_TEXT_CHARS);
  const normalizedComment = (comment || "").trim().slice(0, MAX_ANNOTATION_COMMENT_CHARS);
  if (!normalizedText && !normalizedComment) {
    return null;
  }

  const parsedCreatedAt = Date.parse(String(options.createdAt || ""));
  const createdAt = Number.isNaN(parsedCreatedAt)
    ? new Date().toISOString()
    : new Date(parsedCreatedAt).toISOString();

  return {
    selectedText: normalizedText,
    comment: normalizedComment || null,
    createdAt
  };
}

export function buildAnnotations(pendingAnnotations, selectedText, comment, documentText = "") {
  const combined = [];
  const dedupe = new Set();
  for (const annotation of pendingAnnotations || []) {
    const normalized = normalizeAnnotation(annotation?.selectedText ?? "", annotation?.comment ?? "", {
      documentText,
      createdAt: annotation?.createdAt
    });
    if (!normalized) {
      continue;
    }
    const key = `${normalized.selectedText}\u241f${normalized.comment || ""}`;
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    combined.push(normalized);
  }

  const extra = normalizeAnnotation(selectedText, comment, {
    documentText
  });
  if (extra) {
    const key = `${extra.selectedText}\u241f${extra.comment || ""}`;
    if (!dedupe.has(key)) {
      dedupe.add(key);
      combined.push(extra);
    }
  }
  return combined.length ? combined : null;
}
