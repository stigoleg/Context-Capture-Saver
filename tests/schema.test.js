import test from "node:test";
import assert from "node:assert/strict";

import { buildCaptureRecord, buildFileName, validateCaptureRecord } from "../src/schema.js";

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
