import test from "node:test";
import assert from "node:assert/strict";

import { translateMessage } from "../src/i18n.js";

test("translateMessage uses message getter when key is available", () => {
  const text = translateMessage(
    "key",
    "fallback",
    "value",
    (key, substitutions) => (key === "key" ? `translated:${substitutions}` : "")
  );
  assert.equal(text, "translated:value");
});

test("translateMessage falls back when key is missing", () => {
  const text = translateMessage("missing_key", "fallback text", undefined, () => "");
  assert.equal(text, "fallback text");
});
