import test from "node:test";
import assert from "node:assert/strict";

import {
  ANSWERS,
  TileState,
  buildPuzzleForTarget,
  createPuzzle,
  isSolved,
  remainingAnswersForRows,
  scoreGuess,
  signature
} from "../src/puzzle.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("scores exact matches as solved", () => {
  const pattern = scoreGuess("cigar", "cigar");

  assert.equal(signature(pattern), "ccccc");
  assert.equal(isSolved(pattern), true);
});

test("scores present letters", () => {
  assert.equal(signature(scoreGuess("rebut", "cigar")), "paaaa");
});

test("scores duplicate letters with Wordle-style consumption", () => {
  assert.deepEqual(scoreGuess("allee", "apple"), [
    TileState.CORRECT,
    TileState.PRESENT,
    TileState.ABSENT,
    TileState.ABSENT,
    TileState.CORRECT
  ]);
});

test("generated puzzles have five filled rows and one remaining answer", () => {
  for (let seed = 1; seed <= 75; seed += 1) {
    const puzzle = createPuzzle(seededRandom(seed));
    const remaining = remainingAnswersForRows(puzzle.rows);

    assert.equal(puzzle.rows.length, 5, `seed ${seed}`);
    assert.deepEqual(remaining, [puzzle.answer], `seed ${seed}`);
    assert.equal(new Set(puzzle.rows.map((row) => row.word)).size, 5, `seed ${seed}`);

    for (const row of puzzle.rows) {
      assert.notEqual(row.word, puzzle.answer, `seed ${seed} should not prefill the answer`);
      assert.equal(row.pattern.length, 5, `seed ${seed}`);
    }
  }
});

test("a broad sample of target words can be made into one-answer boards", () => {
  for (const [index, answer] of ANSWERS.entries()) {
    if (index % 7 !== 0) {
      continue;
    }

    const puzzle = buildPuzzleForTarget(answer, seededRandom(index + 100));
    assert.ok(puzzle, `expected ${answer} to be buildable`);
    assert.deepEqual(remainingAnswersForRows(puzzle.rows), [answer]);
  }
});
