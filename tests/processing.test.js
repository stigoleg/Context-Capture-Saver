import test from "node:test";
import assert from "node:assert/strict";

import { applyContentPolicies } from "../src/processing.js";

test("applyContentPolicies does not truncate document text", async () => {
  const record = {
    diagnostics: {},
    content: {
      documentText: "x".repeat(120)
    }
  };

  const next = await applyContentPolicies(record, {
    maxDocumentChars: 50,
    compressLargeText: false,
    compressionThresholdChars: 100,
    includeDiagnostics: true
  });

  assert.equal(next.content.documentText.length, 120);
  assert.equal(next.diagnostics.contentPolicies.truncated, false);
  assert.equal(next.diagnostics.contentPolicies.compressed, false);
  assert.equal(typeof next.content.contentHash, "string");
});

test("applyContentPolicies compresses documentTextParts without joining", async () => {
  const record = {
    diagnostics: {},
    content: {
      documentTextParts: ["alpha", "beta", "gamma"]
    }
  };

  const next = await applyContentPolicies(record, {
    maxDocumentChars: 0,
    compressLargeText: true,
    compressionThresholdChars: 2,
    includeDiagnostics: true
  });

  assert.equal(next.content.documentText, "alpha\n\nbeta\n\ngamma");
  assert.equal(typeof next.content.documentTextCompressed?.value, "string");
  assert.equal(next.diagnostics.contentPolicies.compressed, true);
  assert.equal(typeof next.content.contentHash, "string");
});

test("applyContentPolicies keeps document text unchanged when under limits", async () => {
  const text = "small text";
  const record = {
    diagnostics: {},
    content: {
      documentText: text
    }
  };

  const next = await applyContentPolicies(record, {
    maxDocumentChars: 200,
    compressLargeText: false,
    compressionThresholdChars: 100,
    includeDiagnostics: true
  });

  assert.equal(next.content.documentText, text);
  assert.equal(next.diagnostics.contentPolicies.truncated, false);
  assert.equal(next.diagnostics.contentPolicies.documentTextOriginalLength, text.length);
  assert.equal(typeof next.content.contentHash, "string");
});

test("applyContentPolicies omits diagnostics when disabled", async () => {
  const record = {
    diagnostics: {
      shouldNotPersist: true
    },
    content: {
      documentText: "small text"
    }
  };

  const next = await applyContentPolicies(record, {
    maxDocumentChars: 200,
    compressLargeText: false,
    compressionThresholdChars: 100,
    includeDiagnostics: false
  });

  assert.equal("diagnostics" in next, false);
  assert.equal(next.content.documentTextWordCount, 2);
  assert.equal(next.content.documentTextCharacterCount, 10);
});
