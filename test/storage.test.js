import test from "node:test";
import assert from "node:assert/strict";

import { TileState } from "../src/puzzle.js";
import {
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
    pattern: null
  });
  assert.deepEqual(saved.states[1], {
    guess: "rebut",
    submitted: true,
    pattern: Array(5).fill(TileState.CORRECT)
  });
  assert.deepEqual(saved.states[2], {
    guess: "",
    submitted: false,
    pattern: null
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
      { guess: "", submitted: false, pattern: null },
      { guess: "", submitted: false, pattern: null }
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
    { answer: "cigar", guess: "cigar", submitted: true },
    { answer: "rebut", guess: "reb", submitted: false }
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
