function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function selectionMatchesParts(selection, parts, normalize = false) {
  if (!selection || !Array.isArray(parts)) {
    return false;
  }
  for (const part of parts) {
    if (!part) {
      continue;
    }
    const haystack = normalize ? normalizeWhitespace(part) : String(part);
    if (haystack.includes(selection)) {
      return true;
    }
  }
  return false;
}

export function resolvePdfSelectionFromSources({
  selectedText = "",
  clipboardText = "",
  documentTextParts = []
} = {}) {
  const trimmedSelection = String(selectedText || "").trim();
  if (trimmedSelection) {
    return { text: trimmedSelection, source: "selection" };
  }

  const trimmedClipboard = String(clipboardText || "").trim();
  if (!trimmedClipboard) {
    return { text: "", source: "none" };
  }

  if (selectionMatchesParts(trimmedClipboard, documentTextParts)) {
    return { text: trimmedClipboard, source: "clipboard" };
  }

  const normalizedClip = normalizeWhitespace(trimmedClipboard);
  if (normalizedClip && selectionMatchesParts(normalizedClip, documentTextParts, true)) {
    return { text: normalizedClip, source: "clipboard_normalized" };
  }

  return { text: "", source: "none" };
}
