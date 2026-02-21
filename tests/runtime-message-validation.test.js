import test from "node:test";
import assert from "node:assert/strict";

import {
  runtimeError,
  runtimeSuccess,
  validateRuntimeMessage
} from "../src/runtime-message-validation.js";

test("validateRuntimeMessage rejects malformed and unknown payloads", () => {
  const invalidObject = validateRuntimeMessage(null);
  assert.equal(invalidObject.ok, false);
  assert.equal(invalidObject.errorCode, "invalid_message");

  const missingType = validateRuntimeMessage({});
  assert.equal(missingType.ok, false);
  assert.equal(missingType.errorCode, "missing_type");

  const unknownType = validateRuntimeMessage({ type: "UNKNOWN" });
  assert.equal(unknownType.ok, false);
  assert.equal(unknownType.errorCode, "unknown_type");
});

test("validateRuntimeMessage validates required fields per message type", () => {
  const missingUrl = validateRuntimeMessage({ type: "YT_FETCH_TEXT", url: "" });
  assert.equal(missingUrl.ok, false);
  assert.equal(missingUrl.errorCode, "invalid_url");

  const invalidAnnotation = validateRuntimeMessage({
    type: "REMOVE_PENDING_NOTE",
    annotationId: ""
  });
  assert.equal(invalidAnnotation.ok, false);
  assert.equal(invalidAnnotation.errorCode, "invalid_annotation_id");

  const invalidKind = validateRuntimeMessage({
    type: "RUN_CAPTURE",
    kind: "bad-kind"
  });
  assert.equal(invalidKind.ok, false);
  assert.equal(invalidKind.errorCode, "invalid_capture_kind");
});

test("validateRuntimeMessage returns normalized payload for valid messages", () => {
  const valid = validateRuntimeMessage({
    type: "ADD_NOTE",
    selectedText: "hello",
    comment: "note"
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.message.type, "ADD_NOTE");
  assert.equal(valid.message.selectedText, "hello");
  assert.equal(valid.message.comment, "note");
});

test("runtime response helpers return consistent shapes", () => {
  const ok = runtimeSuccess({ value: 1 });
  assert.deepEqual(ok, { ok: true, value: 1 });

  const err = runtimeError("test_error", "failed", { context: "unit" });
  assert.deepEqual(err, {
    ok: false,
    error: "failed",
    errorCode: "test_error",
    errorDetails: { context: "unit" }
  });
});
