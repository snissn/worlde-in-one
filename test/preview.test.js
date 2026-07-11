import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { deploymentAppUrl } from "../src/urls.js";
import { applyPreviewMeta, normalizeChallengeCode, previewMetaForUrl } from "../worker.js";

test("preview metadata uses the canonical domain and shared challenge code", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const meta = previewMetaForUrl("https://worlde-in-one.snissn.workers.dev/?seed=AbC-234!");
  const preview = applyPreviewMeta(html, meta);

  assert.equal(normalizeChallengeCode(" AbC-234! "), "abc234");
  assert.equal(normalizeChallengeCode("0o1ilx"), "x");
  assert.equal(meta.title, "Wordle in One Challenge ABC234");
  assert.equal(meta.description, "Challenge ABC234: five Wordle boards, one possible answer each.");
  assert.equal(meta.url, "https://wordle-in-one.com/?seed=abc234");
  assert.equal(meta.image, "https://wordle-in-one.com/share-preview.png");

  assert.match(preview, /<title>Wordle in One Challenge ABC234<\/title>/);
  assert.match(preview, /<meta property="og:title" content="Wordle in One Challenge ABC234" \/>/);
  assert.match(preview, /<meta property="og:description" content="Challenge ABC234: five Wordle boards, one possible answer each\." \/>/);
  assert.match(preview, /<meta property="og:url" content="https:\/\/wordle-in-one\.com\/\?seed=abc234" \/>/);
  assert.match(preview, /<meta name="twitter:title" content="Wordle in One Challenge ABC234" \/>/);
  assert.match(preview, /<link rel="canonical" href="https:\/\/wordle-in-one\.com\/\?seed=abc234" \/>/);
});

test("preview metadata falls back to daily copy without a challenge code", () => {
  const meta = previewMetaForUrl("https://worlde-in-one.snissn.workers.dev/");

  assert.equal(meta.title, "Wordle in One");
  assert.equal(meta.description, "Five Wordle boards. One possible answer each.");
  assert.equal(meta.url, "https://wordle-in-one.com/");
});

test("interactive challenge navigation stays on the current deployment", () => {
  assert.equal(
    deploymentAppUrl("http://localhost:8000/?debug=true", "abc234"),
    "http://localhost:8000/?debug=true&seed=abc234"
  );
});

test("daily completion share action keeps its icon and visible label", async () => {
  const [html, main, styles] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /class="completion-share-icon"/);
  assert.match(main, /shareSeedLinkLabel\.textContent = "Share"/);
  assert.doesNotMatch(main, /classList\.add\("icon-only"\)/);
  assert.doesNotMatch(styles, /\.completion-share-action\.icon-only/);
});
