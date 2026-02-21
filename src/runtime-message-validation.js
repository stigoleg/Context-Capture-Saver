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

export function validateRuntimeMessage(message) {
  if (!message || typeof message !== "object") {
    return {
      ok: false,
      errorCode: "invalid_message",
      error: "Message payload must be an object."
    };
  }

  const type = normalizeString(message.type, "").trim();
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

  if ((type === "YT_FETCH_TEXT" || type === "YT_FETCH_JSON") && !normalizeString(message.url).trim()) {
    return {
      ok: false,
      errorCode: "invalid_url",
      error: `${type}.url must be a non-empty string.`
    };
  }

  if (type === "REMOVE_PENDING_NOTE" && !normalizeString(message.annotationId).trim()) {
    return {
      ok: false,
      errorCode: "invalid_annotation_id",
      error: "REMOVE_PENDING_NOTE.annotationId must be a non-empty string."
    };
  }

  if (type === "COMMENT_SUBMIT" && !normalizeString(message.requestId).trim()) {
    return {
      ok: false,
      errorCode: "invalid_request_id",
      error: "COMMENT_SUBMIT.requestId must be a non-empty string."
    };
  }

  if (type === "RUN_CAPTURE" && !RUN_CAPTURE_KINDS.has(normalizeString(message.kind).trim())) {
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
      url: normalizeString(message.url, ""),
      allowClipboardCopy: message.allowClipboardCopy === true,
      selectedText: normalizeString(message.selectedText, ""),
      comment:
        message.comment === undefined || message.comment === null
          ? null
          : normalizeString(message.comment, ""),
      annotationId: normalizeString(message.annotationId, ""),
      requestId: normalizeString(message.requestId, ""),
      cancelled: message.cancelled === true,
      kind: normalizeString(message.kind, "").trim()
    }
  };
}
