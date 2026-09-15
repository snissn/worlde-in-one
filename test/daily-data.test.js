import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { decodeDailyPuzzles, loadPregeneratedDailyPuzzles } from "../src/daily-data.js";
import { createDailyPuzzles, signature } from "../src/puzzle.js";

async function annualData(year) {
  return JSON.parse(await readFile(new URL(`../daily/${year}.json`, import.meta.url), "utf8"));
}

function playableShape(daily) {
  return daily.puzzles.map((puzzle) => [
    puzzle.answer,
    puzzle.difficultyLabel,
    puzzle.rows.map((row) => [row.word, signature(row.pattern)])
  ]);
}

test("annual data covers and decodes every day from 2026 through 2040", async () => {
  let dayCount = 0;

  for (let year = 2026; year <= 2040; year += 1) {
    const payload = await annualData(year);
    const dateKeys = Object.keys(payload.days);
    assert.equal(dateKeys[0], `${year}-01-01`);
    assert.equal(dateKeys.at(-1), `${year}-12-31`);
    for (const dateKey of dateKeys) {
      assert.equal(decodeDailyPuzzles(payload, dateKey).puzzles.length, 5);
      dayCount += 1;
    }
  }

  assert.equal(dayCount, 5479);
});

test("pre-generated horizon endpoints match the browser generator", async () => {
  for (const dateKey of ["2026-01-01", "2040-12-31"]) {
    const decoded = decodeDailyPuzzles(await annualData(dateKey.slice(0, 4)), dateKey);
    assert.deepEqual(playableShape(decoded), playableShape(createDailyPuzzles(dateKey, 5)));
  }
});

test("daily loader uses its annual asset and returns null for browser fallback", async () => {
  const payload = await annualData(2026);
  let requestedUrl = null;
  const loaded = await loadPregeneratedDailyPuzzles("2026-09-15", async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => payload };
  });

  assert.equal(requestedUrl, "/daily/2026.json");
  assert.equal(loaded.dateKey, "2026-09-15");
  assert.equal(await loadPregeneratedDailyPuzzles("2041-01-01", async () => ({ ok: false })), null);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", async () => ({
    ok: true,
    json: async () => ({ version: 1, days: {} })
  })), null);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", async () => { throw new Error("offline"); }), null);
});
