import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../../src/utils/escapeHtml.js";

describe("escapeHtml", () => {
  test("escapes each special character on its own", () => {
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml(">"), "&gt;");
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml('"'), "&quot;");
    assert.equal(escapeHtml("'"), "&#39;");
  });

  test("escapes a realistic script-injection attempt", () => {
    const input = `<script>alert("hi")</script>`;
    assert.equal(
      escapeHtml(input),
      "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;"
    );
  });

  test("escapes & before other entities so it doesn't double-escape", () => {
    // If & were escaped after < and >, "<" would become "&lt;" and the
    // leading "&" of that would get re-escaped into "&amp;lt;". Confirms
    // the replace pass is a single scan, not sequential replacements.
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });

  test("leaves ordinary text untouched", () => {
    assert.equal(escapeHtml("Hello world, this is fine."), "Hello world, this is fine.");
  });

  test("coerces non-string input via String()", () => {
    assert.equal(escapeHtml(42), "42");
    assert.equal(escapeHtml(null), "null");
    assert.equal(escapeHtml(undefined), "undefined");
  });

  test("handles empty string", () => {
    assert.equal(escapeHtml(""), "");
  });
});
