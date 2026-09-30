import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  PREGENERATED_END_YEAR,
  PREGENERATED_START_YEAR,
  decodeDailyPuzzles,
  loadPregeneratedDailyPuzzles
} from "../src/daily-data.js";
import {
  VALID_GUESSES, TileState, createDailyPuzzles, dailyUsesEasyOpening, difficultyForPuzzle, honorsLockedClues,
  isEasyPuzzle, lockedCluesForRows, remainingAnswersForRows, scoreGuess, signature
} from "../src/puzzle.js";
import { createEmptyPuzzleState, loadSavedDailyState, saveDailyState } from "../src/storage.js";

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
  let revisedDayCount = 0;
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
      if (dailyUsesEasyOpening(dateKey)) {
        assert.equal(isEasyPuzzle(first), true, dateKey);
        openingBoards.set(JSON.stringify(first.rows), first);
        revisedDayCount += 1;
      }
      dayCount += 1;
    }
  }

  assert.equal(dayCount, 5479);
  assert.equal(revisedDayCount, 5206);
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
  payload.days["2026-10-01"][0] = ["ovoid", "Easy", [
    ["crane", "aaaaa"], ["tolus", "apaaa"], ["himbo", "apaap"], ["pyoid", "aaccc"]
  ]];
  assert.throws(() => decodeDailyPuzzles(payload, "2026-10-01"), /Easy warm-up/);
  assert.equal(await loadPregeneratedDailyPuzzles("2026-10-01", async () => ({
    ok: true, json: async () => payload
  })), null);
});

test("all daily sets before October 1 retain their production answers and clues", async () => {
  const payload = await annualData(2026);
  const originalDays = Object.fromEntries(Object.entries(payload.days)
    .filter(([dateKey]) => dateKey < "2026-10-01"));
  assert.equal(Object.keys(originalDays).length, 273);
  assert.equal(
    createHash("sha256").update(JSON.stringify(originalDays)).digest("hex"),
    "7cb31ccd57f616dc9a74cd2093521fef89ddcffc30784b7e770ef51dda84d13d",
    "all five original puzzles, including their labels and rows, stay unchanged"
  );
  for (const dateKey of Object.keys(originalDays)) {
    assert.deepEqual(playableShape(createDailyPuzzles(dateKey)), originalDays[dateKey], dateKey);
  }
});

test("September 30 saved progress survives an offline reload of the new release", async () => {
  const dateKey = "2026-09-30";
  const daily = decodeDailyPuzzles(await annualData(2026), dateKey);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const states = daily.puzzles.map(() => createEmptyPuzzleState());
  states[0] = {
    guess: daily.puzzles[0].answer,
    submitted: true,
    pattern: Array(5).fill(TileState.CORRECT),
    usedReveal: false
  };
  states[1].guess = daily.puzzles[1].answer.slice(0, 2);
  states[2].guess = daily.puzzles[2].answer;
  states[2].usedReveal = true;
  saveDailyState(daily, 2, states, storage);

  const reloaded = await loadPregeneratedDailyPuzzles(dateKey, async () => {
    throw new Error("offline");
  }) ?? createDailyPuzzles(dateKey);
  assert.deepEqual(playableShape(reloaded), playableShape(daily));
  assert.deepEqual(loadSavedDailyState(reloaded, storage), { activePuzzleIndex: 2, states });
});

test("pre-generated horizon endpoints match the browser generator", async () => {
  for (const dateKey of ["2026-01-01", "2026-09-30", "2026-10-01", "2040-12-31"]) {
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
