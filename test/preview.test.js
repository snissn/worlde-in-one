import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { applyPreviewMeta, normalizeChallengeCode, previewMetaForUrl } from "../worker.js";

test("preview metadata includes the shared challenge code", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const meta = previewMetaForUrl("https://example.com/?seed=AbC-123!");
  const preview = applyPreviewMeta(html, meta);

  assert.equal(normalizeChallengeCode(" AbC-123! "), "abc123");
  assert.equal(meta.title, "Wordle in One Challenge ABC123");
  assert.equal(meta.description, "Challenge ABC123: five Wordle boards, one possible answer each.");
  assert.equal(meta.url, "https://example.com/?seed=abc123");
  assert.equal(meta.image, "https://example.com/share-preview.png");

  assert.match(preview, /<title>Wordle in One Challenge ABC123<\/title>/);
  assert.match(preview, /<meta property="og:title" content="Wordle in One Challenge ABC123" \/>/);
  assert.match(preview, /<meta property="og:description" content="Challenge ABC123: five Wordle boards, one possible answer each\." \/>/);
  assert.match(preview, /<meta property="og:url" content="https:\/\/example\.com\/\?seed=abc123" \/>/);
  assert.match(preview, /<meta name="twitter:title" content="Wordle in One Challenge ABC123" \/>/);
  assert.match(preview, /<link rel="canonical" href="https:\/\/example\.com\/\?seed=abc123" \/>/);
});

test("preview metadata falls back to daily copy without a challenge code", () => {
  const meta = previewMetaForUrl("https://example.com/");

  assert.equal(meta.title, "Wordle in One");
  assert.equal(meta.description, "Five Wordle boards. One possible answer each.");
  assert.equal(meta.url, "https://example.com/");
});
