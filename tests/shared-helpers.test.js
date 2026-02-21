import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBubbleMenuActions,
  normalizeBubbleMenuConfig,
  normalizeBubbleMenuLayout,
  normalizeBubbleMenuStyle
} from "../src/bubble-settings.js";
import { buildJsonSubdirectories, formatStoredPath } from "../src/json-paths.js";
import { parseYouTubeVideoId } from "../src/url-helpers.js";
import { normalizeStorageBackend, resolveStorageBackendWrites } from "../src/storage-backend.js";

test("bubble settings helpers normalize order/enabled/layout/style consistently", () => {
  const actions = normalizeBubbleMenuActions(
    ["highlight_with_note", "save_content", "highlight_with_note", "unknown"],
    ["highlight_with_note", "unknown"]
  );
  assert.deepEqual(actions.order.slice(0, 2), ["highlight_with_note", "save_content"]);
  assert.deepEqual(actions.enabled, ["highlight_with_note"]);

  const full = normalizeBubbleMenuConfig({
    bubbleMenuOrder: ["highlight"],
    bubbleMenuEnabled: [],
    bubbleMenuLayout: "vertical",
    bubbleMenuStyle: "clean"
  });
  assert.equal(full.layout, "vertical");
  assert.equal(full.style, "clean");
  assert.equal(full.order.includes("save_content"), true);
  assert.equal(full.enabled.length >= 1, true);

  assert.equal(normalizeBubbleMenuLayout("bad", "horizontal"), "horizontal");
  assert.equal(normalizeBubbleMenuStyle("bad", "glass"), "glass");
});

test("json path helpers produce stable storage paths", () => {
  const record = {
    captureType: "selected_text",
    savedAt: "2026-02-21T09:12:00.000Z"
  };
  const settings = {
    organizeByDate: true,
    organizeByType: true,
    organizeOrder: "date_type"
  };
  const subdirs = buildJsonSubdirectories(record, settings);
  assert.deepEqual(subdirs, ["json", "2026-02-21", "selected-text"]);
  assert.equal(
    formatStoredPath("capture.json", subdirs),
    "json/2026-02-21/selected-text/capture.json"
  );
});

test("url and storage backend helpers normalize consistently", () => {
  assert.equal(
    parseYouTubeVideoId("https://www.youtube.com/watch?v=abc123"),
    "abc123"
  );
  assert.equal(parseYouTubeVideoId("https://vimeo.com/123"), null);

  assert.equal(normalizeStorageBackend("sqlite"), "sqlite");
  assert.equal(normalizeStorageBackend("invalid"), "json");

  const writes = resolveStorageBackendWrites("both");
  assert.equal(writes.writesJson, true);
  assert.equal(writes.writesSqlite, true);
});
