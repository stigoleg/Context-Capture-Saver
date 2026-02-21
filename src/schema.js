import { computeContentHash } from "./hash.js";
import {
  MAX_ANNOTATION_COMMENT_CHARS,
  MAX_ANNOTATION_TEXT_CHARS,
  sanitizeAnnotations
} from "./annotation-policy.js";

export const SCHEMA_VERSION = "1.4.0";

function countWords(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return 0;
  }
  return normalized.split(/\s+/).filter(Boolean).length;
}

function computeDocumentTextStats(text) {
  const normalized = String(text || "");
  return {
    documentTextWordCount: countWords(normalized),
    documentTextCharacterCount: normalized.length
  };
}

export function buildCaptureRecord({ captureType, source, content, diagnostics = undefined }) {
  const documentText = content?.documentText ?? null;
  const contentHash = content?.contentHash ?? computeContentHash(documentText ?? "");
  const textStats = computeDocumentTextStats(documentText ?? "");
  const record = {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    captureType,
    savedAt: new Date().toISOString(),
    source: {
      url: source?.url || null,
      title: source?.title || null,
      publishedAt: source?.publishedAt || null,
      site: source?.site || null,
      language: source?.language || null,
      metadata: source?.metadata || {}
    },
    content: {
      documentText,
      ...textStats,
      documentTextParts: content?.documentTextParts ?? null,
      documentTextCompressed: content?.documentTextCompressed ?? null,
      contentHash,
      chunks: content?.chunks ?? null,
      annotations: content?.annotations ?? null,
      transcriptText: content?.transcriptText ?? null,
      transcriptSegments: content?.transcriptSegments ?? null
    }
  };

  if (diagnostics && typeof diagnostics === "object") {
    record.diagnostics = {
      extractorVersion: "1",
      ...diagnostics
    };
  }

  return record;
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildFileName(record) {
  const stamp = record.savedAt
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\..+$/, "")
    .replace("Z", "");

  const typePart = slugify(record.captureType || "capture") || "capture";
  const sitePart = slugify(record.source?.metadata?.videoId || record.source?.site || "site") || "site";
  const titlePart = slugify(record.source?.title || "untitled") || "untitled";

  return `${stamp}_${typePart}_${sitePart}_${titlePart}.json`;
}

export function validateCaptureRecord(record) {
  const errors = [];
  const allowedCaptureTypes = ["selected_text", "youtube_transcript", "pdf_document", "settings_test"];

  if (!record || typeof record !== "object") {
    return {
      valid: false,
      errors: ["Record must be an object"]
    };
  }

  if (record.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }

  if (!record.id || typeof record.id !== "string") {
    errors.push("id is required");
  }

  if (!allowedCaptureTypes.includes(record.captureType)) {
    errors.push("captureType is invalid");
  }

  if (!record.savedAt || Number.isNaN(Date.parse(record.savedAt))) {
    errors.push("savedAt must be a valid ISO datetime");
  }

  if (!record.source || typeof record.source !== "object") {
    errors.push("source is required");
  } else {
    if (!record.source.url || typeof record.source.url !== "string") {
      errors.push("source.url is required");
    }
    if (!record.source.title || typeof record.source.title !== "string") {
      errors.push("source.title is required");
    }
  }

  if (!record.content || typeof record.content !== "object") {
    errors.push("content is required");
  } else {
    const hasDocumentText = typeof record.content.documentText === "string";
    const hasCompressed =
      record.content.documentTextCompressed &&
      typeof record.content.documentTextCompressed.value === "string";
    if (!hasDocumentText && !hasCompressed) {
      errors.push("content.documentText or content.documentTextCompressed.value is required");
    }
    if (hasDocumentText && typeof record.content.contentHash !== "string") {
      errors.push("content.contentHash is required when content.documentText is present");
    }
    if (typeof record.content.documentTextWordCount !== "number") {
      errors.push("content.documentTextWordCount is required");
    }
    if (typeof record.content.documentTextCharacterCount !== "number") {
      errors.push("content.documentTextCharacterCount is required");
    }

    if (record.content.annotations !== null && record.content.annotations !== undefined) {
      if (!Array.isArray(record.content.annotations)) {
        errors.push("content.annotations must be an array when provided");
      } else {
        for (const annotation of record.content.annotations) {
          if (!annotation || typeof annotation !== "object") {
            errors.push("content.annotations entries must be objects");
            continue;
          }
          const selectedText = annotation.selectedText === undefined ? "" : String(annotation.selectedText);
          const comment = annotation.comment === undefined || annotation.comment === null
            ? null
            : String(annotation.comment);
          if (selectedText.length > MAX_ANNOTATION_TEXT_CHARS) {
            errors.push(
              `content.annotations.selectedText exceeds ${MAX_ANNOTATION_TEXT_CHARS} characters`
            );
          }
          if (comment !== null && comment.length > MAX_ANNOTATION_COMMENT_CHARS) {
            errors.push(
              `content.annotations.comment exceeds ${MAX_ANNOTATION_COMMENT_CHARS} characters`
            );
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function applyAnnotationPolicies(record, options = {}) {
  if (!record || typeof record !== "object" || !record.content || typeof record.content !== "object") {
    return record;
  }

  const includeDiagnostics = options.includeDiagnostics !== false;
  const { annotations, stats } = sanitizeAnnotations(record.content.annotations, {
    savedAt: record.savedAt
  });

  const next = {
    ...record,
    content: {
      ...record.content,
      annotations: annotations.length ? annotations : null
    }
  };

  const hadTruncation = stats.truncatedTextCount > 0 || stats.truncatedCommentCount > 0;
  const hadDrops = stats.droppedCount > 0;
  if (includeDiagnostics && (hadTruncation || hadDrops)) {
    next.diagnostics = {
      ...(record.diagnostics && typeof record.diagnostics === "object" ? record.diagnostics : {}),
      annotationPolicies: {
        policy: "truncate",
        ...stats
      }
    };
  }

  return next;
}
