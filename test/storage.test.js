import test from "node:test";
import assert from "node:assert/strict";

import { TileState } from "../src/puzzle.js";
import {
  loadDailyStreak,
  loadSavedDailyState,
  saveDailyState,
  storageKey
} from "../src/storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function dailySet(answers) {
  return {
    dateKey: "2026-06-12",
    puzzles: answers.map((answer) => ({ answer }))
  };
}

test("saved daily state survives releases that change unrelated puzzle answers", () => {
  const daily = dailySet(["cigar", "rebut", "sissy"]);
  const storage = memoryStorage({
    [storageKey(daily.dateKey)]: JSON.stringify({
      version: 1,
      dateKey: daily.dateKey,
      answers: ["rebut", "cigar", "awake"],
      activePuzzleIndex: 1,
      states: [
        { guess: "rebut", submitted: true },
        { guess: "cig", submitted: false },
        { guess: "awake", submitted: true }
      ]
    })
  });

  const saved = loadSavedDailyState(daily, storage);

  assert.equal(saved.activePuzzleIndex, 0);
  assert.deepEqual(saved.states[0], {
    guess: "cig",
    submitted: false,
    pattern: null,
    usedReveal: false
  });
  assert.deepEqual(saved.states[1], {
    guess: "rebut",
    submitted: true,
    pattern: Array(5).fill(TileState.CORRECT),
    usedReveal: false
  });
  assert.deepEqual(saved.states[2], {
    guess: "",
    submitted: false,
    pattern: null,
    usedReveal: false
  });
});

test("saved daily state uses per-puzzle answer identity from newer saves", () => {
  const daily = dailySet(["cigar", "rebut"]);
  const storage = memoryStorage({
    [storageKey(daily.dateKey)]: JSON.stringify({
      version: 1,
      dateKey: daily.dateKey,
      answers: ["cigar", "rebut"],
      activePuzzleIndex: 1,
      activeAnswer: "cigar",
      states: [
        { answer: "rebut", guess: "rebut", submitted: true },
        { answer: "cigar", guess: "cig", submitted: false }
      ]
    })
  });

  const saved = loadSavedDailyState(daily, storage);

  assert.equal(saved.activePuzzleIndex, 0);
  assert.equal(saved.states[0].guess, "cig");
  assert.equal(saved.states[1].guess, "rebut");
  assert.equal(saved.states[1].submitted, true);
});

test("saved daily state still resets for another date", () => {
  const daily = dailySet(["cigar", "rebut"]);
  const storage = memoryStorage({
    [storageKey(daily.dateKey)]: JSON.stringify({
      version: 1,
      dateKey: "2026-06-11",
      answers: ["cigar", "rebut"],
      activePuzzleIndex: 1,
      states: [
        { guess: "cigar", submitted: true },
        { guess: "reb", submitted: false }
      ]
    })
  });

  assert.deepEqual(loadSavedDailyState(daily, storage), {
    activePuzzleIndex: 0,
    states: [
      { guess: "", submitted: false, pattern: null, usedReveal: false },
      { guess: "", submitted: false, pattern: null, usedReveal: false }
    ]
  });
});

test("save daily state writes answer identities for future release recovery", () => {
  const daily = dailySet(["cigar", "rebut"]);
  const storage = memoryStorage();

  saveDailyState(daily, 1, [
    { guess: "cigar", submitted: true },
    { guess: "reb", submitted: false }
  ], storage);

  const saved = JSON.parse(storage.getItem(storageKey(daily.dateKey)));

  assert.equal(saved.activeAnswer, "rebut");
  assert.deepEqual(saved.answers, ["cigar", "rebut"]);
  assert.deepEqual(saved.states, [
    { answer: "cigar", guess: "cigar", submitted: true, usedReveal: false },
    { answer: "rebut", guess: "reb", submitted: false, usedReveal: false }
  ]);
});

test("seeded play state is isolated by puzzle set key", () => {
  const daily = dailySet(["cigar"]);
  const seed = {
    dateKey: "seed-abc123",
    puzzles: [{ answer: "cigar" }]
  };
  const storage = memoryStorage();

  saveDailyState(daily, 0, [{ guess: "cigar", submitted: true }], storage);
  saveDailyState(seed, 0, [{ guess: "ci", submitted: false }], storage);

  assert.equal(JSON.parse(storage.getItem(storageKey(daily.dateKey))).states[0].guess, "cigar");
  assert.equal(JSON.parse(storage.getItem(storageKey(seed.dateKey))).states[0].guess, "ci");
  assert.equal(loadSavedDailyState(daily, storage).states[0].guess, "cigar");
  assert.equal(loadSavedDailyState(seed, storage).states[0].guess, "ci");
});

test("reveal attribution survives reload and follows its answer across releases", () => {
  const daily = dailySet(["cigar", "rebut"]);
  const storage = memoryStorage();
  saveDailyState(daily, 0, [
    { guess: "cigar", submitted: false, usedReveal: true },
    { guess: "", submitted: false, usedReveal: false }
  ], storage);

  const restored = loadSavedDailyState(dailySet(["rebut", "cigar"]), storage);
  assert.equal(restored.activePuzzleIndex, 1);
  assert.equal(restored.states[1].usedReveal, true);
  assert.equal(restored.states[1].submitted, false);
  assert.equal(restored.states[0].usedReveal, false);
});

test("daily streak uses existing valid solves, keeps yesterday's streak, and includes revealed solves", () => {
  const storage = memoryStorage();
  const save = (dateKey, usedReveal = false) => saveDailyState({
    dateKey, puzzles: [{ answer: "cigar" }]
  }, 0, [{ guess: "cigar", submitted: true, usedReveal }], storage);
  const today = new Date(2028, 2, 1, 12);
  save("2028-02-28");
  save("2028-02-29");
  save("2028-03-02");
  save("seed-abc234");
  assert.equal(loadDailyStreak(today, storage), 2);
  save("2028-03-01", true);
  assert.equal(loadDailyStreak(today, storage), 3);
  save("2028-03-01", true);
  assert.equal(loadDailyStreak(today, storage), 3, "repeat saves do not add streak days");
  assert.equal(loadDailyStreak(new Date(2028, 2, 5, 12), storage), 0, "a missed day breaks the streak");

  storage.setItem(storageKey("2028-02-29"), "broken json");
  assert.equal(loadDailyStreak(today, storage), 1);
  storage.setItem(storageKey("2028-03-01"), JSON.stringify({
    version: 1, dateKey: "2028-03-01", states: [{ answer: "cigar", guess: "rebut", submitted: true }]
  }));
  assert.equal(loadDailyStreak(today, storage), 0, "invalid submissions cannot earn a streak");
  assert.equal(loadDailyStreak(today, { getItem() { throw new Error("blocked"); } }), null);
});

test("daily streak steps through local calendar dates across both DST transitions", (t) => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  t.after(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });
  for (const dates of [["2026-03-07", "2026-03-08", "2026-03-09"], ["2026-10-31", "2026-11-01", "2026-11-02"]]) {
    const storage = memoryStorage();
    for (const dateKey of dates) {
      saveDailyState({ dateKey, puzzles: [{ answer: "cigar" }] }, 0, [{ guess: "cigar", submitted: true }], storage);
    }
    assert.equal(loadDailyStreak(new Date(`${dates[2]}T00:01:00`), storage), 3);
  }
});
