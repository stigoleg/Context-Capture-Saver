import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAnnotationPolicies,
  buildCaptureRecord,
  buildFileName,
  validateCaptureRecord
} from "../src/schema.js";
import {
  MAX_ANNOTATION_COMMENT_CHARS,
  MAX_ANNOTATION_TEXT_CHARS
} from "../src/annotation-policy.js";

function buildSample(overrides = {}) {
  return buildCaptureRecord({
    captureType: "selected_text",
    source: {
      url: "https://example.com/article",
      title: "A sample article",
      site: "example.com",
      language: "en",
      publishedAt: "2025-01-01T12:00:00.000Z",
      metadata: {}
    },
    content: {
      documentText: "full document text",
      annotations: [
        {
          selectedText: "selected",
          comment: "note",
          createdAt: "2026-02-18T00:00:00.000Z"
        }
      ]
    },
    diagnostics: {},
    ...overrides
  });
}

test("validateCaptureRecord accepts a valid record", () => {
  const record = buildSample();
  const result = validateCaptureRecord(record);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(typeof record.content.contentHash, "string");
  assert.equal(record.content.documentTextWordCount, 3);
  assert.equal(record.content.documentTextCharacterCount, 18);
});

test("validateCaptureRecord rejects missing source url", () => {
  const record = buildSample();
  record.source.url = null;
  const result = validateCaptureRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" | "), /source\.url is required/);
});

test("buildFileName sanitizes unsafe title characters", () => {
  const record = buildSample();
  record.source.title = "Hello, World! $$$ and Spaces";
  const filename = buildFileName(record);
  assert.match(filename, /hello-world-and-spaces\.json$/);
});

test("diagnostics are optional in schema records", () => {
  const record = buildCaptureRecord({
    captureType: "selected_text",
    source: {
      url: "https://example.com/article",
      title: "A sample article",
      site: "example.com",
      language: "en",
      publishedAt: "2025-01-01T12:00:00.000Z",
      metadata: {}
    },
    content: {
      documentText: "hello world"
    }
  });

  assert.equal(record.diagnostics, undefined);
  const result = validateCaptureRecord(record);
  assert.equal(result.valid, true);
});

test("applyAnnotationPolicies truncates oversized annotation fields and records diagnostics", () => {
  const record = buildSample({
    content: {
      documentText: "full document text",
      annotations: [
        {
          selectedText: "x".repeat(MAX_ANNOTATION_TEXT_CHARS + 10),
          comment: "y".repeat(MAX_ANNOTATION_COMMENT_CHARS + 12),
          createdAt: "2026-02-18T00:00:00.000Z"
        }
      ]
    }
  });

  const next = applyAnnotationPolicies(record, { includeDiagnostics: true });
  const annotation = next.content.annotations[0];
  assert.equal(annotation.selectedText.length, MAX_ANNOTATION_TEXT_CHARS);
  assert.equal(annotation.comment.length, MAX_ANNOTATION_COMMENT_CHARS);
  assert.equal(next.diagnostics.annotationPolicies.truncatedTextCount, 1);
  assert.equal(next.diagnostics.annotationPolicies.truncatedCommentCount, 1);
});

test("validateCaptureRecord rejects oversized annotation payloads when unsanitized", () => {
  const record = buildSample();
  record.content.annotations = [
    {
      selectedText: "a".repeat(MAX_ANNOTATION_TEXT_CHARS + 1),
      comment: "b".repeat(MAX_ANNOTATION_COMMENT_CHARS + 1),
      createdAt: "2026-02-18T00:00:00.000Z"
    }
  ];

  const result = validateCaptureRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" | "), /selectedText exceeds/);
  assert.match(result.errors.join(" | "), /comment exceeds/);
});
