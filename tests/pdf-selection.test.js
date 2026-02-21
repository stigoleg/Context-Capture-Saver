import test from "node:test";
import assert from "node:assert/strict";

import { resolvePdfSelectionFromSources } from "../src/pdf-selection.js";

test("resolvePdfSelectionFromSources prefers explicit selected text", () => {
  const result = resolvePdfSelectionFromSources({
    selectedText: "from selection",
    clipboardText: "from clipboard",
    documentTextParts: ["from clipboard"]
  });
  assert.deepEqual(result, { text: "from selection", source: "selection" });
});

test("resolvePdfSelectionFromSources falls back to clipboard direct match", () => {
  const result = resolvePdfSelectionFromSources({
    selectedText: "",
    clipboardText: "Needle phrase",
    documentTextParts: ["prefix Needle phrase suffix"]
  });
  assert.deepEqual(result, { text: "Needle phrase", source: "clipboard" });
});

test("resolvePdfSelectionFromSources supports normalized whitespace fallback", () => {
  const result = resolvePdfSelectionFromSources({
    selectedText: "",
    clipboardText: "Needle    phrase",
    documentTextParts: ["prefix Needle phrase suffix"]
  });
  assert.deepEqual(result, { text: "Needle phrase", source: "clipboard_normalized" });
});

test("resolvePdfSelectionFromSources returns none when no match exists", () => {
  const result = resolvePdfSelectionFromSources({
    selectedText: "",
    clipboardText: "absent",
    documentTextParts: ["different text"]
  });
  assert.deepEqual(result, { text: "", source: "none" });
});
