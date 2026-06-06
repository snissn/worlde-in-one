import test from "node:test";
import assert from "node:assert/strict";

import {
  ANSWERS,
  VALID_GUESSES,
  TileState,
  buildPuzzleForTarget,
  createPuzzle,
  honorsLockedClues,
  isSolved,
  lockedCluesForRows,
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

test("uses the full Wordle-sized word lists", () => {
  assert.equal(ANSWERS.length, 2315);
  assert.equal(VALID_GUESSES.length, 12972);
  assert.equal(new Set(ANSWERS).size, ANSWERS.length);
  assert.equal(new Set(VALID_GUESSES).size, VALID_GUESSES.length);
});

test("solver starts with a common Wordle opener instead of a random probe", () => {
  const puzzle = buildPuzzleForTarget("study");

  assert.equal(puzzle.rows[0].word, "crane");
  assert.ok(puzzle.rows.length < 5, "puzzles do not need padding to guess six");
});

test("locked clue helper requires green spots and yellow letters", () => {
  const rows = [{ word: "crane", pattern: scoreGuess("crane", "crown") }];
  const clues = lockedCluesForRows(rows);

  assert.deepEqual(clues.correctPositions.slice(0, 2), ["c", "r"]);
  assert.equal(clues.requiredCounts.c, 1);
  assert.equal(clues.requiredCounts.r, 1);
  assert.equal(clues.requiredCounts.n, 1);
  assert.equal(honorsLockedClues("crown", rows), true);
  assert.equal(honorsLockedClues("cross", rows), false, "must include the yellow N");
  assert.equal(honorsLockedClues("crony", rows), false, "yellow N cannot stay in the same spot");
});

test("generated puzzles stop once one answer remains", () => {
  for (let seed = 1; seed <= 75; seed += 1) {
    const puzzle = createPuzzle(seededRandom(seed));
    const remaining = remainingAnswersForRows(puzzle.rows);
    const beforeLast = remainingAnswersForRows(puzzle.rows.slice(0, -1));

    assert.ok(puzzle.rows.length >= 1 && puzzle.rows.length <= 5, `seed ${seed}`);
    assert.deepEqual(remaining, [puzzle.answer], `seed ${seed}`);
    assert.ok(beforeLast.length > 1, `seed ${seed} should not include padding guesses`);
    assert.equal(new Set(puzzle.rows.map((row) => row.word)).size, puzzle.rows.length, `seed ${seed}`);

    for (const [index, row] of puzzle.rows.entries()) {
      assert.notEqual(row.word, puzzle.answer, `seed ${seed} should not prefill the answer`);
      assert.equal(row.pattern.length, 5, `seed ${seed}`);
      assert.equal(honorsLockedClues(row.word, puzzle.rows.slice(0, index)), true, `seed ${seed} row ${index + 1}`);
    }
  }
});

test("a broad sample of target words can be made into one-answer boards", () => {
  let buildable = 0;
  let skipped = 0;

  for (const [index, answer] of ANSWERS.entries()) {
    if (index % 7 !== 0) {
      continue;
    }

    const puzzle = buildPuzzleForTarget(answer);
    if (!puzzle) {
      skipped += 1;
      continue;
    }

    buildable += 1;
    assert.deepEqual(remainingAnswersForRows(puzzle.rows), [answer]);

    for (const [rowIndex, row] of puzzle.rows.entries()) {
      assert.equal(honorsLockedClues(row.word, puzzle.rows.slice(0, rowIndex)), true);
    }
  }

  assert.ok(buildable >= 300, `expected most sampled answers to be buildable, got ${buildable}`);
  assert.ok(skipped <= 10, `expected only a few hard-mode skips, got ${skipped}`);
});
