import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  PREGENERATED_END_YEAR,
  PREGENERATED_START_YEAR,
  decodeDailyPuzzles,
  loadPregeneratedDailyPuzzles
} from "../src/daily-data.js";
import {
  VALID_GUESSES, createDailyPuzzles, difficultyForPuzzle, honorsLockedClues,
  isEasyPuzzle, lockedCluesForRows, remainingAnswersForRows, scoreGuess, signature
} from "../src/puzzle.js";

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

test("annual data covers and decodes every day in the pre-generated horizon", async () => {
  let dayCount = 0;
  const openingBoards = new Map();

  for (let year = PREGENERATED_START_YEAR; year <= PREGENERATED_END_YEAR; year += 1) {
    const payload = await annualData(year);
    const dateKeys = Object.keys(payload.days);
    assert.equal(dateKeys[0], `${year}-01-01`);
    assert.equal(dateKeys.at(-1), `${year}-12-31`);
    for (const dateKey of dateKeys) {
      const daily = decodeDailyPuzzles(payload, dateKey);
      assert.equal(daily.puzzles.length, 5);
      const first = daily.puzzles[0];
      assert.equal(isEasyPuzzle(first), true, dateKey);
      openingBoards.set(JSON.stringify(first.rows), first);
      dayCount += 1;
    }
  }

  assert.equal(dayCount, 5479);
  for (const first of openingBoards.values()) {
    const clues = lockedCluesForRows(first.rows);
    assert.equal(clues.correctPositions.filter(Boolean).length, 3);
    assert.equal(Object.values(clues.requiredCounts).reduce((sum, count) => sum + count, 0), 4);
    assert.equal(new Set(first.answer).size, 5);
    assert.deepEqual(remainingAnswersForRows(first.rows), [first.answer]);
    assert.ok(remainingAnswersForRows(first.rows.slice(0, -1)).length > 1);
    assert.equal(difficultyForPuzzle(first).band.id, "easy");
    for (const [index, row] of first.rows.entries()) {
      assert.ok(VALID_GUESSES.includes(row.word));
      assert.notEqual(row.word, first.answer);
      assert.deepEqual(row.pattern, scoreGuess(row.word, first.answer));
      assert.equal(honorsLockedClues(row.word, first.rows.slice(0, index)), true);
    }
  }
});

test("stale annual data cannot serve a harder board under the Easy label", async () => {
  const payload = await annualData(2026);
  payload.days["2026-09-15"][0] = ["ovoid", "Easy", [
    ["crane", "aaaaa"], ["tolus", "apaaa"], ["himbo", "apaap"], ["pyoid", "aaccc"]
  ]];
  assert.throws(() => decodeDailyPuzzles(payload, "2026-09-15"), /Easy warm-up/);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", async () => ({
    ok: true, json: async () => payload
  })), null);
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
  let outOfRangeRequests = 0;
  for (const dateKey of ["2025-12-31", "2041-01-01"]) {
    assert.equal(await loadPregeneratedDailyPuzzles(dateKey, async () => {
      outOfRangeRequests += 1;
      return { ok: false };
    }), null);
  }
  assert.equal(outOfRangeRequests, 0);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", async () => ({
    ok: true,
    json: async () => ({ version: 1, days: {} })
  })), null);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", async () => { throw new Error("offline"); }), null);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-09-15", (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason));
  }), 1), null);
});
