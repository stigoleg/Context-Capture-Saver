import test from "node:test";
import assert from "node:assert/strict";

import { createPendingAnnotationsStore } from "../src/pending-annotations.js";

test("pending annotation lifecycle supports add/snapshot/remove/take/clear", () => {
  const store = createPendingAnnotationsStore();
  const tabId = 7;

  const first = store.add(tabId, { selectedText: "alpha", comment: null });
  assert.equal(first.count, 1);
  assert.equal(typeof first.annotation.id, "string");

  const second = store.add(tabId, { selectedText: "beta", comment: "note" });
  assert.equal(second.count, 2);

  const snapshot = store.snapshot(tabId);
  assert.equal(snapshot.length, 2);
  assert.equal(snapshot[1].comment, "note");

  const removed = store.remove(tabId, first.annotation.id);
  assert.equal(removed.removed, true);
  assert.equal(removed.count, 1);

  const taken = store.take(tabId);
  assert.equal(taken.length, 1);
  assert.equal(store.snapshot(tabId).length, 0);

  store.add(tabId, { selectedText: "gamma", comment: null });
  assert.equal(store.snapshot(tabId).length, 1);
  store.clear(tabId);
  assert.equal(store.snapshot(tabId).length, 0);
});
