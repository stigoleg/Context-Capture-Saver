import test from "node:test";
import assert from "node:assert/strict";

import { createLogger, setGlobalLogLevel } from "../src/logger.js";

function createSink(calls) {
  return {
    error(...args) {
      calls.push({ method: "error", args });
    },
    warn(...args) {
      calls.push({ method: "warn", args });
    },
    info(...args) {
      calls.push({ method: "info", args });
    },
    debug(...args) {
      calls.push({ method: "debug", args });
    }
  };
}

test("logger respects log level gating", () => {
  const calls = [];
  const logger = createLogger({
    module: "unit",
    runId: "run-levels",
    sink: createSink(calls)
  });

  setGlobalLogLevel("off");
  logger.error("hidden");
  logger.info("hidden");
  assert.equal(calls.length, 0);

  setGlobalLogLevel("error");
  logger.info("hidden");
  logger.error("visible");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "error");

  setGlobalLogLevel("debug");
  logger.debug("visible-debug");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "debug");
});

test("logger prefixes module/run id and redacts sensitive fields", () => {
  const calls = [];
  const logger = createLogger({
    module: "unit:background",
    runId: "run-redaction",
    sink: createSink(calls),
    levelResolver: () => "info"
  });

  logger.info("capture complete", {
    selectedText: "very secret sentence",
    comment: "private note",
    plain: "visible",
    nested: {
      documentText: "huge content value"
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "info");
  assert.match(calls[0].args[0], /\[ccs\]\[info\]\[unit:background\]\[run-redaction\]/);

  const payload = calls[0].args[2];
  assert.equal(payload.selectedText.startsWith("[redacted:"), true);
  assert.equal(payload.comment.startsWith("[redacted:"), true);
  assert.equal(payload.plain, "visible");
  assert.equal(payload.nested.documentText.startsWith("[redacted:"), true);
});

test("logger supports child modules and run override", () => {
  const calls = [];
  const base = createLogger({
    module: "unit",
    runId: "run-base",
    sink: createSink(calls),
    levelResolver: () => "info"
  });

  const child = base.child("worker");
  child.info("child message");
  const newRun = child.withRun("run-child");
  newRun.info("second message");

  assert.equal(calls.length, 2);
  assert.match(calls[0].args[0], /\[unit:worker\]\[run-base\]/);
  assert.match(calls[1].args[0], /\[unit:worker\]\[run-child\]/);
});
