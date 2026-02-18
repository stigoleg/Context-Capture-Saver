export const SCHEMA_VERSION = "1.2.0";

export function buildCaptureRecord({ captureType, source, content, diagnostics = {} }) {
  return {
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
      selectedText: content?.selectedText ?? null,
      documentText: content?.documentText ?? null,
      documentTextParts: content?.documentTextParts ?? null,
      documentTextCompressed: content?.documentTextCompressed ?? null,
      comment: content?.comment ?? null,
      transcriptText: content?.transcriptText ?? null,
      transcriptSegments: content?.transcriptSegments ?? null
    },
    diagnostics: {
      extractorVersion: "1",
      ...diagnostics
    }
  };
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
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
