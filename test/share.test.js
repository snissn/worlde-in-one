import test from "node:test";
import assert from "node:assert/strict";
import { completionSharePayload } from "../src/share.js";

const states = [false, true, false, false, true].map((usedReveal) => ({
  submitted: true,
  usedReveal,
  guess: "cigar",
  answer: "cigar"
}));

test("daily results include ordered reveal usage and date without exposing words", () => {
  const result = completionSharePayload({ mode: "daily", dateKey: "2026-09-21" }, states);
  assert.deepEqual(result, {
    title: "Word in One · Daily 2026-09-21",
    text: "Word in One · Daily 2026-09-21\n🟩🟨🟩🟩🟨 5/5 puzzles\n🟩 No Reveal · 🟨 Used Reveal\nPlay today's puzzles:",
    url: "https://word-in-one.com/"
  });
  assert.doesNotMatch(JSON.stringify(result), /cigar/);
});

test("challenge results identify and link the same challenge", () => {
  const result = completionSharePayload({ mode: "seed", dateKey: "seed-abc234", shareSeed: "abc234" }, states);
  assert.equal(result.title, "Word in One · Challenge ABC234");
  assert.match(result.text, /🟩🟨🟩🟩🟨 5\/5/);
  assert.match(result.text, /Play this challenge:/);
  assert.doesNotMatch(result.text, /today|seed-abc234|cigar/);
  assert.equal(result.url, "https://word-in-one.com/?seed=abc234");
});
