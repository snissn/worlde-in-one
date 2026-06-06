import { ANSWERS, VALID_GUESSES } from "./words.js";

export const TileState = Object.freeze({
  ABSENT: "absent",
  PRESENT: "present",
  CORRECT: "correct"
});

const VALID_GUESS_SET = new Set(VALID_GUESSES);
const STARTER_WORDS = Object.freeze(["crane", "slate", "trace", "roast", "adieu"]);
const DEFAULT_DAILY_CANDIDATE_POOL_SIZE = 12;

for (const starter of STARTER_WORDS) {
  if (!VALID_GUESS_SET.has(starter)) {
    throw new Error(`Starter word is not a valid guess: ${starter}`);
  }
}

function buildGlobalWordStats() {
  const letters = Object.create(null);
  const positions = Array.from({ length: 5 }, () => Object.create(null));

  for (const answer of ANSWERS) {
    const unique = new Set();

    for (let i = 0; i < answer.length; i += 1) {
      const letter = answer[i];
      positions[i][letter] = (positions[i][letter] ?? 0) + 1;
      unique.add(letter);
    }

    for (const letter of unique) {
      letters[letter] = (letters[letter] ?? 0) + 1;
    }
  }

  return Object.freeze({ letters, positions });
}

const GLOBAL_WORD_STATS = buildGlobalWordStats();

function wordQuality(word) {
  const unique = new Set();
  let score = 0;

  for (let i = 0; i < word.length; i += 1) {
    const letter = word[i];
    score += GLOBAL_WORD_STATS.positions[i][letter] ?? 0;

    if (unique.has(letter)) {
      score -= ANSWERS.length * 0.12;
    } else {
      score += (GLOBAL_WORD_STATS.letters[letter] ?? 0) * 1.25;
      unique.add(letter);
    }
  }

  return score;
}

function compareKeys(left, right) {
  if (!right) {
    return -1;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }

  return 0;
}

export function normalizeWord(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 5);
}

export function isValidGuess(word) {
  return VALID_GUESS_SET.has(normalizeWord(word));
}

export function scoreGuess(guessInput, answerInput) {
  const guess = normalizeWord(guessInput);
  const answer = normalizeWord(answerInput);

  if (guess.length !== 5 || answer.length !== 5) {
    throw new Error("scoreGuess expects two five-letter words");
  }

  const result = Array(5).fill(TileState.ABSENT);
  const remainingAnswer = answer.split("");

  for (let i = 0; i < 5; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = TileState.CORRECT;
      remainingAnswer[i] = null;
    }
  }

  for (let i = 0; i < 5; i += 1) {
    if (result[i] === TileState.CORRECT) {
      continue;
    }

    const foundAt = remainingAnswer.indexOf(guess[i]);
    if (foundAt !== -1) {
      result[i] = TileState.PRESENT;
      remainingAnswer[foundAt] = null;
    }
  }

  return result;
}

export function signature(pattern) {
  return pattern
    .map((state) => {
      if (state === TileState.CORRECT) return "c";
      if (state === TileState.PRESENT) return "p";
      return "a";
    })
    .join("");
}

export function isSolved(pattern) {
  return pattern.every((state) => state === TileState.CORRECT);
}

function buildLockedClues(rows) {
  const correctPositions = Array(5).fill(null);
  const forbiddenPositions = Array.from({ length: 5 }, () => new Set());
  const requiredCounts = new Map();

  for (const row of rows) {
    const word = normalizeWord(row.word);
    const coloredCounts = new Map();

    for (let i = 0; i < 5; i += 1) {
      const letter = word[i];
      const state = row.pattern[i];

      if (state === TileState.CORRECT) {
        correctPositions[i] = letter;
        coloredCounts.set(letter, (coloredCounts.get(letter) ?? 0) + 1);
      } else if (state === TileState.PRESENT) {
        forbiddenPositions[i].add(letter);
        coloredCounts.set(letter, (coloredCounts.get(letter) ?? 0) + 1);
      }
    }

    for (const [letter, count] of coloredCounts.entries()) {
      requiredCounts.set(letter, Math.max(requiredCounts.get(letter) ?? 0, count));
    }
  }

  return { correctPositions, forbiddenPositions, requiredCounts };
}

function wordHonorsClues(wordInput, clues) {
  const word = normalizeWord(wordInput);
  if (word.length !== 5) {
    return false;
  }

  const counts = new Map();

  for (let i = 0; i < 5; i += 1) {
    const letter = word[i];
    const required = clues.correctPositions[i];

    if (required && letter !== required) {
      return false;
    }

    if (clues.forbiddenPositions[i].has(letter)) {
      return false;
    }

    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  for (const [letter, requiredCount] of clues.requiredCounts.entries()) {
    if ((counts.get(letter) ?? 0) < requiredCount) {
      return false;
    }
  }

  return true;
}

export function lockedCluesForRows(rows) {
  const clues = buildLockedClues(rows);
  return Object.freeze({
    correctPositions: Object.freeze([...clues.correctPositions]),
    forbiddenPositions: Object.freeze(clues.forbiddenPositions.map((positions) => Object.freeze([...positions]))),
    requiredCounts: Object.freeze(Object.fromEntries(clues.requiredCounts.entries()))
  });
}

export function honorsLockedClues(word, rows) {
  return wordHonorsClues(word, buildLockedClues(rows));
}

function matchingCandidates(candidates, guess, pattern) {
  const wanted = signature(pattern);
  return candidates.filter((candidate) => signature(scoreGuess(guess, candidate)) === wanted);
}

function patternCounts(candidates, guess) {
  const counts = new Map();

  for (const candidate of candidates) {
    const key = signature(scoreGuess(guess, candidate));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function solverMetrics(candidates, guess) {
  const counts = patternCounts(candidates, guess);
  let worstBucket = 0;
  let sumSquares = 0;
  let entropy = 0;

  for (const count of counts.values()) {
    worstBucket = Math.max(worstBucket, count);
    sumSquares += count * count;

    const probability = count / candidates.length;
    entropy -= probability * Math.log2(probability);
  }

  return {
    counts,
    entropy,
    expectedRemaining: sumSquares / candidates.length,
    worstBucket
  };
}

function chooseOpeningGuess(target, used) {
  for (const starter of STARTER_WORDS) {
    if (starter !== target && !used.has(starter)) {
      return starter;
    }
  }

  return null;
}

function chooseInformationProbe(target, candidates, used, rows) {
  const lockedClues = buildLockedClues(rows);
  let best = null;
  let bestKey = null;

  for (const guess of candidates) {
    if (guess === target || used.has(guess) || !wordHonorsClues(guess, lockedClues)) {
      continue;
    }

    const metrics = solverMetrics(candidates, guess);
    const pattern = scoreGuess(guess, target);
    const nextCount = metrics.counts.get(signature(pattern)) ?? 0;

    if (nextCount >= candidates.length) {
      continue;
    }

    const key = [
      Math.round(metrics.expectedRemaining * 1000),
      metrics.worstBucket,
      nextCount,
      -Math.round(metrics.entropy * 1000),
      -Math.round(wordQuality(guess)),
      guess
    ];

    if (compareKeys(key, bestKey) < 0) {
      best = guess;
      bestKey = key;
    }
  }

  return best;
}

function shuffled(words, rng) {
  const copy = [...words];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashString(input) {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function seededRandomFromString(input) {
  let value = hashString(input);

  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateKeyForPuzzle(date = new Date()) {
  if (typeof date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Date keys must look like YYYY-MM-DD: ${date}`);
    }

    return date;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function difficultyLabelForRank(index, count) {
  if (count === 5) {
    return ["Easy", "Medium", "Tricky", "Hard", "Expert"][index];
  }

  return `#${index + 1}`;
}

function answerDuplicateCount(answer) {
  return answer.length - new Set(answer).size;
}

function countConstraintViolations(wordInput, clues) {
  const word = normalizeWord(wordInput);
  const counts = new Map();
  let violations = 0;

  for (let i = 0; i < 5; i += 1) {
    const letter = word[i];
    const required = clues.correctPositions[i];

    if (required && letter !== required) {
      violations += 1;
    }

    if (clues.forbiddenPositions[i].has(letter)) {
      violations += 1;
    }

    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  for (const [letter, requiredCount] of clues.requiredCounts.entries()) {
    violations += Math.max(0, requiredCount - (counts.get(letter) ?? 0));
  }

  return violations;
}

function puzzleClueFeatures(puzzle, includeNearMisses = false) {
  const rows = puzzle.rows;
  const beforeLastCount = rows.length > 1
    ? remainingAnswersForRows(rows.slice(0, -1)).length
    : ANSWERS.length;
  const lockedClues = buildLockedClues(rows);
  const correctPositions = lockedClues.correctPositions.filter(Boolean).length;
  const requiredLetters = [...lockedClues.requiredCounts.values()]
    .reduce((total, count) => total + count, 0);
  let greenTiles = 0;
  let yellowTiles = 0;
  let grayTiles = 0;
  let maxRowCorrect = 0;
  let maxRowColored = 0;

  for (const row of rows) {
    let rowCorrect = 0;
    let rowColored = 0;

    for (const state of row.pattern) {
      if (state === TileState.CORRECT) {
        greenTiles += 1;
        rowCorrect += 1;
        rowColored += 1;
      } else if (state === TileState.PRESENT) {
        yellowTiles += 1;
        rowColored += 1;
      } else {
        grayTiles += 1;
      }
    }

    maxRowCorrect = Math.max(maxRowCorrect, rowCorrect);
    maxRowColored = Math.max(maxRowColored, rowColored);
  }

  let oneViolationMisses = 0;
  let twoViolationMisses = 0;
  if (includeNearMisses) {
    for (const answer of ANSWERS) {
      if (answer === puzzle.answer) {
        continue;
      }

      const violations = countConstraintViolations(answer, lockedClues);
      if (violations <= 1) {
        oneViolationMisses += 1;
      }
      if (violations <= 2) {
        twoViolationMisses += 1;
      }
    }
  }

  return {
    rows: rows.length,
    beforeLastCount,
    correctPositions,
    requiredLetters,
    greenTiles,
    yellowTiles,
    grayTiles,
    maxRowCorrect,
    maxRowColored,
    oneViolationMisses,
    twoViolationMisses,
    duplicateLetters: answerDuplicateCount(puzzle.answer)
  };
}

export function isTrivialPuzzle(puzzle) {
  const features = puzzleClueFeatures(puzzle);

  return features.correctPositions >= 4 ||
    (features.correctPositions >= 3 && features.requiredLetters >= 4) ||
    features.maxRowCorrect >= 4 ||
    (features.maxRowCorrect >= 3 && features.maxRowColored === 5);
}

export function remainingAnswersForRows(rows, answers = ANSWERS) {
  return rows.reduce(
    (candidates, row) => matchingCandidates(candidates, row.word, row.pattern),
    [...answers]
  );
}

export function difficultyForPuzzle(puzzle) {
  const features = puzzleClueFeatures(puzzle, true);
  const unknownPositions = 5 - features.correctPositions;
  const unknownLetters = 5 - features.requiredLetters;
  const score = Math.round(
    (unknownLetters * 420) +
    (unknownPositions * 260) +
    (Math.log2(features.beforeLastCount + 1) * 180) +
    (Math.log2(features.twoViolationMisses + 1) * 280) +
    (features.oneViolationMisses * 55) +
    (features.rows * 90) +
    (features.duplicateLetters * 220) -
    (features.greenTiles * 8) -
    (features.yellowTiles * 5)
  );

  return Object.freeze({
    score,
    ...features,
    unknownLetters,
    unknownPositions
  });
}

export function buildPuzzleForTarget(targetInput) {
  const target = normalizeWord(targetInput);
  if (!ANSWERS.includes(target)) {
    throw new Error(`Unknown answer word: ${targetInput}`);
  }

  let candidates = [...ANSWERS];
  const used = new Set();
  const rows = [];

  while (rows.length < 5 && candidates.length > 1) {
    const guess = rows.length === 0
      ? chooseOpeningGuess(target, used)
      : chooseInformationProbe(target, candidates, used, rows);

    if (!guess) {
      return null;
    }

    const pattern = scoreGuess(guess, target);
    rows.push({ word: guess, pattern });
    used.add(guess);
    candidates = matchingCandidates(candidates, guess, pattern);
  }

  if (candidates.length !== 1 || candidates[0] !== target) {
    return null;
  }

  const remaining = remainingAnswersForRows(rows);
  if (remaining.length !== 1 || remaining[0] !== target) {
    return null;
  }

  const puzzle = Object.freeze({
    answer: target,
    rows: Object.freeze(rows.map((row) => Object.freeze({ ...row, pattern: Object.freeze([...row.pattern]) }))),
    remaining: Object.freeze(remaining)
  });

  if (isTrivialPuzzle(puzzle)) {
    return null;
  }

  return puzzle;
}

export function createPuzzle(rng = Math.random) {
  for (const target of shuffled(ANSWERS, rng)) {
    const puzzle = buildPuzzleForTarget(target);
    if (puzzle) {
      return puzzle;
    }
  }

  throw new Error("Could not generate a one-answer Wordle puzzle");
}

function selectDifficultySpread(puzzles, count) {
  const sorted = [...puzzles].sort((left, right) => compareKeys(
    [left.difficulty.score, left.answer],
    [right.difficulty.score, right.answer]
  ));
  const quantiles = count === 5
    ? [0.08, 0.30, 0.50, 0.70, 0.92]
    : Array.from({ length: count }, (_, index) => (index + 0.5) / count);
  const selected = [];
  const used = new Set();

  for (const quantile of quantiles) {
    const preferred = Math.round(quantile * (sorted.length - 1));
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let index = 0; index < sorted.length; index += 1) {
      if (used.has(index)) {
        continue;
      }

      const distance = Math.abs(index - preferred);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex !== -1) {
      used.add(bestIndex);
      selected.push(sorted[bestIndex]);
    }
  }

  return selected.sort((left, right) => compareKeys(
    [left.difficulty.score, left.answer],
    [right.difficulty.score, right.answer]
  ));
}

export function createDailyPuzzles(date = new Date(), count = 5, options = {}) {
  const dateKey = dateKeyForPuzzle(date);
  const rng = seededRandomFromString(`wordle-in-one:${dateKey}`);
  const poolSize = options.poolSize ?? Math.max(DEFAULT_DAILY_CANDIDATE_POOL_SIZE, count * 2);
  const pool = [];

  for (const target of shuffled(ANSWERS, rng)) {
    const puzzle = buildPuzzleForTarget(target);
    if (!puzzle) {
      continue;
    }

    pool.push({
      ...puzzle,
      difficulty: difficultyForPuzzle(puzzle)
    });

    if (pool.length === poolSize) {
      break;
    }
  }

  if (pool.length < count) {
    throw new Error(`Could only generate ${pool.length} daily puzzles for ${dateKey}`);
  }

  const puzzles = selectDifficultySpread(pool, count);

  return Object.freeze({
    dateKey,
    puzzles: Object.freeze(puzzles.map((puzzle, index) => Object.freeze({
      ...puzzle,
      dailyNumber: index + 1,
      difficultyLabel: difficultyLabelForRank(index, count)
    })))
  });
}

export { ANSWERS, VALID_GUESSES };
