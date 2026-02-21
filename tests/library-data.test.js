import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaptureSummaryFromJsonRecord,
  buildCaptureSummaryFromSqlite,
  extractFilterOptions,
  filterAndSortCaptures,
  paginateCaptures
} from "../src/library-data.js";

test("library-data builds stable summaries for sqlite/json rows", () => {
  const sqliteSummary = buildCaptureSummaryFromSqlite({
    capture_id: "cap-1",
    document_id: "doc-1",
    capture_type: "selected_text",
    saved_at: "2026-02-21T10:00:00.000Z",
    document_url: "https://example.com/a",
    document_title: "Example A",
    document_site: "example.com"
  });

  assert.equal(sqliteSummary.backend, "sqlite");
  assert.equal(sqliteSummary.captureId, "cap-1");
  assert.equal(sqliteSummary.sourceTitle, "Example A");

  const jsonSummary = buildCaptureSummaryFromJsonRecord(
    {
      id: "cap-2",
      captureType: "youtube_transcript",
      savedAt: "2026-02-20T10:00:00.000Z",
      source: {
        url: "https://youtube.com/watch?v=abc",
        title: "Video",
        site: "youtube.com"
      },
      content: {
        chunks: [{ chunkType: "transcript_segment", text: "line 1" }]
      }
    },
    "json/youtube/cap-2.json"
  );

  assert.equal(jsonSummary.backend, "json");
  assert.equal(jsonSummary.storagePath, "json/youtube/cap-2.json");
  assert.equal(jsonSummary.meta.chunkCount, 1);
});

test("library-data filters and sorts captures with deterministic results", () => {
  const captures = [
    {
      captureId: "c1",
      captureType: "selected_text",
      savedAt: "2026-02-20T10:00:00.000Z",
      savedAtMs: Date.parse("2026-02-20T10:00:00.000Z"),
      sourceTitle: "Zeta",
      sourceUrl: "https://a.example.com",
      sourceSite: "example.com"
    },
    {
      captureId: "c2",
      captureType: "youtube_transcript",
      savedAt: "2026-02-21T10:00:00.000Z",
      savedAtMs: Date.parse("2026-02-21T10:00:00.000Z"),
      sourceTitle: "Alpha",
      sourceUrl: "https://youtube.com/watch?v=abc",
      sourceSite: "youtube.com"
    }
  ];

  const filtered = filterAndSortCaptures(
    captures,
    { site: "youtube.com", search: "alpha" },
    { field: "title", direction: "asc" }
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].captureId, "c2");

  const sortedBySavedAtAsc = filterAndSortCaptures(captures, {}, { field: "savedAt", direction: "asc" });
  assert.deepEqual(
    sortedBySavedAtAsc.map((entry) => entry.captureId),
    ["c1", "c2"]
  );
});

test("library-data paginates and extracts filter options", () => {
  const captures = Array.from({ length: 62 }, (_, index) => ({
    captureId: `c-${index}`,
    captureType: index % 2 === 0 ? "selected_text" : "youtube_transcript",
    sourceSite: index % 3 === 0 ? "example.com" : "youtube.com",
    savedAtMs: index,
    savedAt: "2026-02-21T00:00:00.000Z",
    sourceTitle: "T",
    sourceUrl: "U"
  }));

  const page = paginateCaptures(captures, 2, 25);
  assert.equal(page.page, 2);
  assert.equal(page.items.length, 25);
  assert.equal(page.totalPages, 3);

  const options = extractFilterOptions(captures);
  assert.deepEqual(options.captureTypes, ["selected_text", "youtube_transcript"]);
  assert.deepEqual(options.sites, ["example.com", "youtube.com"]);
});
