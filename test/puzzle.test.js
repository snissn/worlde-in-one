import test from "node:test";
import assert from "node:assert/strict";

import {
  ANSWERS,
  CLASSIC_ANSWERS,
  VALID_GUESSES,
  TileState,
  buildPuzzleForTarget,
  createDailyPuzzles,
  createPuzzle,
  dateKeyForPuzzle,
  difficultyForPuzzle,
  honorsLockedClues,
  isSolved,
  isTrivialPuzzle,
  lockedCluesForRows,
  remainingAnswersForRows,
  scoreGuess,
  scrabbleScoreForWord,
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

test("uses classic Wordle answers but validates uniqueness against every official guess", () => {
  assert.equal(CLASSIC_ANSWERS.length, 2315);
  assert.equal(VALID_GUESSES.length, 12972);
  assert.deepEqual(ANSWERS, CLASSIC_ANSWERS);
  assert.equal(new Set(CLASSIC_ANSWERS).size, CLASSIC_ANSWERS.length);
  assert.equal(new Set(VALID_GUESSES).size, VALID_GUESSES.length);

  const classicAnswers = new Set(CLASSIC_ANSWERS);
  const validGuesses = new Set(VALID_GUESSES);

  for (const word of CLASSIC_ANSWERS) {
    assert.ok(validGuesses.has(word), `${word} classic answer should be accepted as a valid guess`);
  }

  for (const historicAnswer of ["cigar", "rebut", "sissy", "humph", "awake", "siege"]) {
    assert.ok(classicAnswers.has(historicAnswer), `${historicAnswer} should be in the classic answer list`);
  }

  for (const allowedGuess of ["aahed", "aalii", "aargh", "zuzim", "zygal", "zymic", "maids"]) {
    assert.ok(validGuesses.has(allowedGuess), `${allowedGuess} should be in the official allowed guesses`);
    assert.equal(classicAnswers.has(allowedGuess), false, `${allowedGuess} should not be a classic answer`);
  }
});

test("difficulty includes Scrabble letter values", () => {
  assert.equal(scrabbleScoreForWord("jewel"), 15);
  assert.equal(scrabbleScoreForWord("llama"), 7);

  const jewel = difficultyForPuzzle({ answer: "jewel", rows: [] });
  const llama = difficultyForPuzzle({ answer: "llama", rows: [] });

  assert.ok(jewel.score > llama.score, "higher Scrabble words should sort harder when clues are tied");
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

test("trivial swap puzzles are rejected", () => {
  const trivial = {
    answer: "adobe",
    rows: [{ word: "abode", pattern: scoreGuess("abode", "adobe") }],
    remaining: ["adobe"]
  };

  assert.equal(signature(trivial.rows[0].pattern), "cpcpc");
  assert.equal(isTrivialPuzzle(trivial), true);
  assert.equal(buildPuzzleForTarget("adobe"), null);
});

test("classic-only June 8 board is not unique when all valid guesses can be answers", () => {
  const classicRows = [
    { word: "crane", pattern: scoreGuess("crane", "basis") },
    { word: "salty", pattern: scoreGuess("salty", "basis") }
  ];

  assert.deepEqual(remainingAnswersForRows(classicRows, CLASSIC_ANSWERS), ["basis"]);
  assert.equal(VALID_GUESSES.includes("maids"), true, "maids is an allowed guess");
  assert.equal(ANSWERS.includes("maids"), false, "maids is not a classic answer");
  assert.equal(honorsLockedClues("maids", classicRows), true, "maids matches the visible clues");
  assert.equal(VALID_GUESSES.includes("maxim"), true, "maxim is an allowed guess");
  assert.equal(ANSWERS.includes("maxim"), true, "maxim is a classic answer");
  assert.equal(honorsLockedClues("maxim", classicRows), false, "maxim does not match the SALTY clue");
  assert.ok(remainingAnswersForRows(classicRows).length > 1, "classic board should not be valid because multiple valid guesses fit");
});

test("daily puzzles are deterministic and sorted by difficulty", () => {
  assert.equal(dateKeyForPuzzle(new Date(2026, 0, 2)), "2026-01-02");

  const first = createDailyPuzzles("2026-06-05", 5);
  const second = createDailyPuzzles("2026-06-05", 5);
  const nextDay = createDailyPuzzles("2026-06-06", 5);

  assert.equal(first.dateKey, "2026-06-05");
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.answer), second.puzzles.map((puzzle) => puzzle.answer));
  assert.notDeepEqual(first.puzzles.map((puzzle) => puzzle.answer), nextDay.puzzles.map((puzzle) => puzzle.answer));
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.difficultyLabel), ["Easy", "Medium", "Tricky", "Hard", "Expert"]);

  for (let i = 1; i < first.puzzles.length; i += 1) {
    assert.ok(
      first.puzzles[i - 1].difficulty.score <= first.puzzles[i].difficulty.score,
      "daily puzzles should be easiest to hardest"
    );
  }

  for (const puzzle of first.puzzles) {
    assert.deepEqual(remainingAnswersForRows(puzzle.rows), [puzzle.answer]);
    assert.equal(isTrivialPuzzle(puzzle), false);
  }
});

test("generated puzzles stop once one answer remains", () => {
  for (let seed = 1; seed <= 10; seed += 1) {
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
    if (index % 257 !== 0) {
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

  assert.ok(buildable >= 3, `expected sampled answers to include buildable non-trivial boards, got ${buildable}`);
  assert.ok(skipped <= 8, `expected sampled skips to stay bounded, got ${skipped}`);
});
