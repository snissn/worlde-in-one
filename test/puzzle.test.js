import test from "node:test";
import assert from "node:assert/strict";

import {
  ANSWERS,
  CLASSIC_ANSWERS,
  DIFFICULTY_BANDS,
  SHARE_SEED_ALPHABET,
  VALID_GUESSES,
  TileState,
  buildPuzzleForTarget,
  createDailyPuzzles,
  createPuzzle,
  createSeededPuzzles,
  dailyChallengeSeed,
  dailyChallengeSeedIndex,
  dateKeyForPuzzle,
  difficultyBandForScore,
  difficultyForPuzzle,
  generateShareSeed,
  honorsLockedClues,
  isSolved,
  isTrivialPuzzle,
  lockedCluesForRows,
  normalizeShareSeed,
  remainingAnswersForRows,
  scoreGuess,
  scrabbleScoreForWord,
  signature,
  violatedExcludedLetterTiles,
  violatedLockedClueTiles
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

test("Scrabble utility is not a primary difficulty signal", () => {
  assert.equal(scrabbleScoreForWord("jewel"), 15);
  assert.equal(scrabbleScoreForWord("llama"), 7);

  const jewel = difficultyForPuzzle({ answer: "jewel", rows: [] });
  const llama = difficultyForPuzzle({ answer: "llama", rows: [] });

  assert.equal(jewel.score, llama.score, "same clue board should score the same regardless of answer letter rarity");
  assert.equal(jewel.band.id, llama.band.id);
  assert.equal("scrabbleScore" in jewel, false);
});

test("difficulty bands are fixed score ranges", () => {
  for (const band of DIFFICULTY_BANDS) {
    assert.equal(difficultyBandForScore(band.targetScore).id, band.id);
  }

  const hard = DIFFICULTY_BANDS.find((band) => band.id === "hard");
  assert.equal(hard.representativeWindow, 1, "Hard should pick the closest upper-band representative");
  assert.ok(hard.targetScore > (hard.minScore + hard.maxScore) / 2);

  assert.equal(difficultyBandForScore(DIFFICULTY_BANDS[1].minScore).id, DIFFICULTY_BANDS[1].id);
  assert.equal(difficultyBandForScore(DIFFICULTY_BANDS[2].minScore - 1).id, DIFFICULTY_BANDS[1].id);
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
  assert.deepEqual(violatedLockedClueTiles("crown", rows), []);
  assert.deepEqual(violatedLockedClueTiles("cross", rows), [{ rowIndex: 0, tileIndex: 3 }]);
  assert.deepEqual(violatedLockedClueTiles("crony", rows), [{ rowIndex: 0, tileIndex: 3 }]);
  assert.deepEqual(violatedLockedClueTiles("spare", rows), [
    { rowIndex: 0, tileIndex: 0 },
    { rowIndex: 0, tileIndex: 1 },
    { rowIndex: 0, tileIndex: 3 }
  ]);
});

test("excluded clue helper points at black letters that rule out a guess", () => {
  const fullyExcludedRows = [{ word: "crane", pattern: scoreGuess("crane", "pouty") }];
  assert.deepEqual(violatedExcludedLetterTiles("spilt", fullyExcludedRows), []);
  assert.deepEqual(violatedExcludedLetterTiles("cigar", fullyExcludedRows), [
    { rowIndex: 0, tileIndex: 0 },
    { rowIndex: 0, tileIndex: 1 },
    { rowIndex: 0, tileIndex: 2 }
  ]);

  const duplicateRows = [{ word: "allee", pattern: scoreGuess("allee", "apple") }];
  assert.equal(signature(duplicateRows[0].pattern), "cpaac");
  assert.deepEqual(violatedExcludedLetterTiles("apple", duplicateRows), []);
  assert.deepEqual(violatedExcludedLetterTiles("eagle", duplicateRows), [
    { rowIndex: 0, tileIndex: 3 }
  ]);

  const udderRows = ["crane", "sorer", "liter", "heder"]
    .map((word) => ({ word, pattern: scoreGuess(word, "udder") }));
  assert.deepEqual(udderRows.map((row) => signature(row.pattern)), ["apaap", "aaacc", "aaacc", "aaccc"]);
  assert.equal(honorsLockedClues("ruder", udderRows), true, "RUDER satisfies the green/yellow placements");
  assert.deepEqual(violatedExcludedLetterTiles("ruder", udderRows), [
    { rowIndex: 1, tileIndex: 2 }
  ], "the black R in SORER limits the answer to one R");
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

test("daily puzzles are deterministic and fill fixed difficulty bands", () => {
  assert.equal(dateKeyForPuzzle(new Date(2026, 0, 2)), "2026-01-02");

  const first = createDailyPuzzles("2026-06-05", 5);
  const second = createDailyPuzzles("2026-06-05", 5);
  const nextDay = createDailyPuzzles("2026-06-06", 5);
  const expectedLabels = DIFFICULTY_BANDS.map((band) => band.label);

  assert.equal(first.dateKey, "2026-06-05");
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.answer), second.puzzles.map((puzzle) => puzzle.answer));
  assert.notDeepEqual(first.puzzles.map((puzzle) => puzzle.answer), nextDay.puzzles.map((puzzle) => puzzle.answer));
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.difficultyLabel), expectedLabels);
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.difficulty.band.label), expectedLabels);

  for (let i = 1; i < first.puzzles.length; i += 1) {
    assert.ok(
      first.puzzles[i - 1].difficulty.score <= first.puzzles[i].difficulty.score,
      "daily puzzles should be easiest to hardest"
    );
  }

  for (const puzzle of first.puzzles) {
    assert.deepEqual(remainingAnswersForRows(puzzle.rows), [puzzle.answer]);
    assert.equal(isTrivialPuzzle(puzzle), false);
    assert.equal(puzzle.difficulty.band.label, puzzle.difficultyLabel);
    assert.ok(puzzle.difficulty.score >= puzzle.difficulty.band.minScore);
    assert.ok(puzzle.difficulty.score < puzzle.difficulty.band.maxScore);
  }

  for (const dateKey of ["2026-06-01", "2026-06-02", "2026-06-03"]) {
    assert.deepEqual(
      createDailyPuzzles(dateKey, 5).puzzles.map((puzzle) => puzzle.difficultyLabel),
      expectedLabels,
      `${dateKey} should include one puzzle from each band`
    );
  }
});

test("share seeds generate deterministic replayable puzzle sets", () => {
  const shareSeedPattern = new RegExp(`^[${SHARE_SEED_ALPHABET}]{6}$`);

  assert.equal(normalizeShareSeed(" AbC-234! "), "abc234");
  assert.equal(normalizeShareSeed("a b c"), "abc");
  assert.equal(normalizeShareSeed("0o1ilx"), "x");
  assert.match(generateShareSeed(() => 0), shareSeedPattern);
  assert.match(dailyChallengeSeed("2026-06-12", 1), shareSeedPattern);
  assert.equal(dailyChallengeSeed("2026-06-12", 1), dailyChallengeSeed("2026-06-12", 1));
  assert.notEqual(dailyChallengeSeed("2026-06-12", 1), dailyChallengeSeed("2026-06-12", 2));
  assert.notEqual(dailyChallengeSeed("2026-06-12", 1), dailyChallengeSeed("2026-06-13", 1));
  assert.equal(dailyChallengeSeedIndex(dailyChallengeSeed("2026-06-12", 2), "2026-06-12"), 2);
  assert.equal(dailyChallengeSeedIndex(dailyChallengeSeed("2026-06-12", 2), "2026-06-13"), null);
  assert.throws(() => createSeededPuzzles("abc", 5), /at least four/);

  const first = createSeededPuzzles("ABC-234", 5);
  const second = createSeededPuzzles("abc234", 5);
  const other = createSeededPuzzles("abc235", 5);
  const expectedLabels = DIFFICULTY_BANDS.map((band) => band.label);

  assert.equal(first.mode, "seed");
  assert.equal(first.shareSeed, "abc234");
  assert.equal(first.dateKey, "seed-abc234");
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.answer), second.puzzles.map((puzzle) => puzzle.answer));
  assert.notDeepEqual(first.puzzles.map((puzzle) => puzzle.answer), other.puzzles.map((puzzle) => puzzle.answer));
  assert.deepEqual(first.puzzles.map((puzzle) => puzzle.difficultyLabel), expectedLabels);

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
