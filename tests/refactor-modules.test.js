import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import initSqlJs from "sql.js";

import { buildAnnotations, normalizeAnnotation } from "../src/annotation-builders.js";
import { ensureSchemaV2 } from "../src/sqlite-schema.js";
import { saveRecordToDbV2 } from "../src/sqlite-write.js";
import { listRecentCaptures } from "../src/sqlite.js";

const SQL = await initSqlJs({
  locateFile: (file) => path.join(process.cwd(), "node_modules/sql.js/dist", file)
});

test("annotation-builders preserves normalization behavior after refactor", () => {
  const note = normalizeAnnotation("hello world", "note", {
    documentText: "hello world. this is a sentence."
  });
  assert.equal(Boolean(note), true);
  assert.equal(note.comment, "note");

  const annotations = buildAnnotations(
    [{ selectedText: "hello world", comment: "note" }],
    "hello world",
    "note",
    "hello world. this is a sentence."
  );
  assert.equal(Array.isArray(annotations), true);
  assert.equal(annotations.length, 1);
});

test("sqlite schema/write facade modules keep API behavior stable", () => {
  const db = new SQL.Database();
  try {
    ensureSchemaV2(db);
    const record = {
      id: "refactor-modules-capture",
      captureType: "selected_text",
      savedAt: "2026-02-21T22:00:00.000Z",
      source: {
        url: "https://example.com/refactor-modules",
        title: "Refactor Modules",
        site: "example.com",
        language: "en",
        metadata: {}
      },
      content: {
        documentText: "refactor modules smoke test",
        contentHash: "hash-refactor-modules",
        annotations: [],
        transcriptSegments: null
      }
    };

    const saved = saveRecordToDbV2(db, record, { ensureSchema: false, useTransaction: true });
    assert.equal(saved.captureId, "refactor-modules-capture");

    const captures = listRecentCaptures(db, 5, 0);
    assert.equal(captures.length, 1);
    assert.equal(captures[0].capture_id, "refactor-modules-capture");
  } finally {
    db.close();
  }
});
