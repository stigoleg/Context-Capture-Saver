export const MAX_ANNOTATION_TEXT_CHARS = 12000;
export const MAX_ANNOTATION_COMMENT_CHARS = 4000;
export const MAX_ANNOTATIONS_PER_CAPTURE = 250;

function normalizeIsoTimestamp(value, fallbackIso = null) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  if (fallbackIso) {
    return fallbackIso;
  }
  return new Date().toISOString();
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function clampStringLength(value, maxChars) {
  const normalized = String(value || "");
  if (normalized.length <= maxChars) {
    return {
      value: normalized,
      truncated: false
    };
  }
  return {
    value: normalized.slice(0, maxChars),
    truncated: true
  };
}

export function sanitizeSingleAnnotation(annotation, options = {}) {
  const savedAt = normalizeIsoTimestamp(options.savedAt);
  const clampedText = clampStringLength(annotation?.selectedText, MAX_ANNOTATION_TEXT_CHARS);
  const rawComment = normalizeNullableString(annotation?.comment);
  const clampedComment = rawComment
    ? clampStringLength(rawComment, MAX_ANNOTATION_COMMENT_CHARS)
    : { value: null, truncated: false };

  const selectedText = clampedText.value.trim();
  const comment = normalizeNullableString(clampedComment.value);
  if (!selectedText && !comment) {
    return {
      annotation: null,
      stats: {
        truncatedText: clampedText.truncated,
        truncatedComment: clampedComment.truncated,
        dropped: true
      }
    };
  }

  return {
    annotation: {
      selectedText,
      comment,
      createdAt: normalizeIsoTimestamp(annotation?.createdAt, savedAt)
    },
    stats: {
      truncatedText: clampedText.truncated,
      truncatedComment: clampedComment.truncated,
      dropped: false
    }
  };
}

export function sanitizeAnnotations(input, options = {}) {
  const savedAt = normalizeIsoTimestamp(options.savedAt);
  const raw = Array.isArray(input) ? input : [];
  const annotations = [];
  const maxAnnotations = Number.isFinite(Number(options.maxAnnotations))
    ? Math.max(0, Math.floor(Number(options.maxAnnotations)))
    : MAX_ANNOTATIONS_PER_CAPTURE;

  let truncatedTextCount = 0;
  let truncatedCommentCount = 0;
  let droppedCount = 0;
  let droppedDueToLimit = 0;

  for (let index = 0; index < raw.length; index += 1) {
    if (annotations.length >= maxAnnotations) {
      droppedCount += 1;
      droppedDueToLimit += 1;
      continue;
    }
    const { annotation, stats } = sanitizeSingleAnnotation(raw[index], { savedAt });
    if (stats.truncatedText) {
      truncatedTextCount += 1;
    }
    if (stats.truncatedComment) {
      truncatedCommentCount += 1;
    }
    if (!annotation) {
      droppedCount += 1;
      continue;
    }
    annotations.push(annotation);
  }

  return {
    annotations,
    stats: {
      totalInput: raw.length,
      totalOutput: annotations.length,
      truncatedTextCount,
      truncatedCommentCount,
      droppedCount,
      droppedDueToLimit,
      limits: {
        maxAnnotationTextChars: MAX_ANNOTATION_TEXT_CHARS,
        maxAnnotationCommentChars: MAX_ANNOTATION_COMMENT_CHARS,
        maxAnnotationsPerCapture: maxAnnotations
      }
    }
  };
}
