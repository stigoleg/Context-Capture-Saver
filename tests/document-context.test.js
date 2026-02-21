import test from "node:test";
import assert from "node:assert/strict";

import { buildContextExportPayload, groupChunksByType } from "../src/document-context.js";

test("groupChunksByType groups and counts chunk entries", () => {
  const grouped = groupChunksByType([
    { chunk_type: "note", text: "A" },
    { chunk_type: "highlight", text: "B" },
    { chunk_type: "note", text: "C" },
    { chunkType: "document", text: "D" },
    { text: "E" }
  ]);

  const map = Object.fromEntries(grouped.map((group) => [group.type, group.count]));
  assert.equal(map.note, 2);
  assert.equal(map.highlight, 1);
  assert.equal(map.document, 1);
  assert.equal(map.unknown, 1);
});

test("buildContextExportPayload returns stable object shape", () => {
  const payload = buildContextExportPayload({
    document: { document_id: "doc-1" },
    captures: [{ capture_id: "cap-1" }],
    chunks: [{ chunk_id: "chunk-1" }],
    entities: [{ entity_id: "ent-1" }],
    edges: [{ edge_id: "edge-1" }]
  });

  assert.equal(Boolean(payload.exportedAt), true);
  assert.equal(payload.document.document_id, "doc-1");
  assert.equal(payload.captures.length, 1);
  assert.equal(payload.chunks.length, 1);
  assert.equal(payload.entities.length, 1);
  assert.equal(payload.edges.length, 1);
  assert.equal(Array.isArray(payload.annotations), true);
  assert.equal(Array.isArray(payload.transcriptSegments), true);
});
