const KNOWN_MESSAGE_TYPES = new Set([
  "GET_YT_PLAYER_RESPONSE",
  "YT_FETCH_TEXT",
  "YT_FETCH_JSON",
  "RESOLVE_PDF_SELECTION",
  "ADD_NOTE",
  "GET_PENDING_NOTES",
  "REMOVE_PENDING_NOTE",
  "CLEAR_PENDING_NOTES_STATE",
  "COMMENT_SUBMIT",
  "GET_LAST_CAPTURE_STATUS",
  "RUN_CAPTURE"
]);

const RUN_CAPTURE_KINDS = new Set([
  "selection",
  "selection_with_comment",
  "selection_with_highlight",
  "youtube_transcript",
  "youtube_transcript_with_comment"
]);

/**
 * @typedef {{
 *   type: string;
 *   url?: string;
 *   allowClipboardCopy?: boolean;
 *   selectedText?: string;
 *   comment?: string | null;
 *   annotationId?: string;
 *   requestId?: string;
 *   cancelled?: boolean;
 *   kind?: string;
 * }} RuntimeMessage
 */

/**
 * @typedef {{
 *   ok: boolean;
 *   errorCode?: string;
 *   error?: string;
 *   message?: RuntimeMessage & {
 *     type: string;
 *     url: string;
 *     allowClipboardCopy: boolean;
 *     selectedText: string;
 *     comment: string | null;
 *     annotationId: string;
 *     requestId: string;
 *     cancelled: boolean;
 *     kind: string;
 *   };
 * }} RuntimeMessageValidationResult
 */

function normalizeString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
}

export function runtimeError(code, message, details = null) {
  return {
    ok: false,
    error: message,
    errorCode: code,
    errorDetails: details
  };
}

export function runtimeSuccess(payload = {}) {
  return {
    ok: true,
    ...(payload || {})
  };
}

/**
 * @param {unknown} message
 * @returns {RuntimeMessageValidationResult}
 */
export function validateRuntimeMessage(message) {
  const raw = /** @type {Record<string, any>} */ (message);
  if (!message || typeof message !== "object") {
    return {
      ok: false,
      errorCode: "invalid_message",
      error: "Message payload must be an object."
    };
  }

  const type = normalizeString(raw.type, "").trim();
  if (!type) {
    return {
      ok: false,
      errorCode: "missing_type",
      error: "Message type is required."
    };
  }

  if (!KNOWN_MESSAGE_TYPES.has(type)) {
    return {
      ok: false,
      errorCode: "unknown_type",
      error: `Unknown message type: ${type}`
    };
  }

  if ((type === "YT_FETCH_TEXT" || type === "YT_FETCH_JSON") && !normalizeString(raw.url).trim()) {
    return {
      ok: false,
      errorCode: "invalid_url",
      error: `${type}.url must be a non-empty string.`
    };
  }

  if (type === "REMOVE_PENDING_NOTE" && !normalizeString(raw.annotationId).trim()) {
    return {
      ok: false,
      errorCode: "invalid_annotation_id",
      error: "REMOVE_PENDING_NOTE.annotationId must be a non-empty string."
    };
  }

  if (type === "COMMENT_SUBMIT" && !normalizeString(raw.requestId).trim()) {
    return {
      ok: false,
      errorCode: "invalid_request_id",
      error: "COMMENT_SUBMIT.requestId must be a non-empty string."
    };
  }

  if (type === "RUN_CAPTURE" && !RUN_CAPTURE_KINDS.has(normalizeString(raw.kind).trim())) {
    return {
      ok: false,
      errorCode: "invalid_capture_kind",
      error: "RUN_CAPTURE.kind is invalid."
    };
  }

  return {
    ok: true,
    message: {
      ...message,
      type,
      url: normalizeString(raw.url, ""),
      allowClipboardCopy: raw.allowClipboardCopy === true,
      selectedText: normalizeString(raw.selectedText, ""),
      comment:
        raw.comment === undefined || raw.comment === null
          ? null
          : normalizeString(raw.comment, ""),
      annotationId: normalizeString(raw.annotationId, ""),
      requestId: normalizeString(raw.requestId, ""),
      cancelled: raw.cancelled === true,
      kind: normalizeString(raw.kind, "").trim()
    }
  };
}
