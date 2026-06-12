import { ANSWERS as CLASSIC_ANSWERS, VALID_GUESSES } from "./words.js";

export const ANSWER_BANKS = Object.freeze({
  CLASSIC: "classic",
  ALL_VALID_GUESSES: "all-valid-guesses"
});

export const ANSWERS = CLASSIC_ANSWERS;

export const TileState = Object.freeze({
  ABSENT: "absent",
  PRESENT: "present",
  CORRECT: "correct"
});

const VALID_GUESS_SET = new Set(VALID_GUESSES);
const STARTER_WORDS = Object.freeze(["crane", "slate", "trace", "roast", "adieu"]);
const DEFAULT_DAILY_SPREAD_POOL_SIZE = 12;
const DEFAULT_DAILY_CANDIDATE_POOL_SIZE = 80;
const DEFAULT_DAILY_MIN_CANDIDATE_POOL_SIZE = 16;
const DAILY_BAND_REPRESENTATIVE_WINDOW = 4;
const DEFAULT_PROBE_POOL_SIZE = 320;
const SHARE_SEED_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SHARE_SEED_LENGTH = 6;
const SCRABBLE_POINTS = Object.freeze({
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1,
  j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1,
  s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
});

export const DIFFICULTY_BANDS = Object.freeze([
  Object.freeze({ id: "easy", label: "Easy", minScore: -Infinity, maxScore: 12200, targetScore: 11200 }),
  Object.freeze({ id: "medium", label: "Medium", minScore: 12200, maxScore: 14200, targetScore: 13200 }),
  Object.freeze({ id: "tricky", label: "Tricky", minScore: 14200, maxScore: 16500, targetScore: 15350 }),
  Object.freeze({ id: "hard", label: "Hard", minScore: 16500, maxScore: 20500, targetScore: 18500 }),
  Object.freeze({ id: "expert", label: "Expert", minScore: 20500, maxScore: Infinity, targetScore: 23000 })
]);

for (const starter of STARTER_WORDS) {
  if (!VALID_GUESS_SET.has(starter)) {
    throw new Error(`Starter word is not a valid guess: ${starter}`);
  }
}

function answerBankForMode(mode = ANSWER_BANKS.CLASSIC) {
  if (mode === ANSWER_BANKS.CLASSIC) {
    return CLASSIC_ANSWERS;
  }
  if (mode === ANSWER_BANKS.ALL_VALID_GUESSES) {
    return VALID_GUESSES;
  }
  throw new Error(`Unknown answer bank mode: ${mode}`);
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

export function scrabbleScoreForWord(wordInput) {
  return [...normalizeWord(wordInput)]
    .reduce((score, letter) => score + (SCRABBLE_POINTS[letter] ?? 0), 0);
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

function probeCandidatesFor(candidates, lockedClues, probePoolSize) {
  const hardModeCandidates = candidates.filter((word) => wordHonorsClues(word, lockedClues));
  if (hardModeCandidates.length <= probePoolSize) {
    return hardModeCandidates;
  }

  return hardModeCandidates
    .map((word) => ({ word, quality: wordQuality(word) }))
    .sort((left, right) => right.quality - left.quality || left.word.localeCompare(right.word))
    .slice(0, probePoolSize)
    .map(({ word }) => word);
}

function chooseInformationProbe(target, candidates, used, rows, probePoolSize = DEFAULT_PROBE_POOL_SIZE) {
  const lockedClues = buildLockedClues(rows);
  let best = null;
  let bestKey = null;

  for (const guess of probeCandidatesFor(candidates, lockedClues, probePoolSize)) {
    if (guess === target || used.has(guess)) {
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

export function normalizeShareSeed(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
}

export function generateShareSeed(rng = Math.random) {
  let seed = "";

  for (let i = 0; i < SHARE_SEED_LENGTH; i += 1) {
    seed += SHARE_SEED_ALPHABET[Math.floor(rng() * SHARE_SEED_ALPHABET.length)];
  }

  return seed;
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

function puzzleClueFeatures(puzzle, includeNearMisses = false, answers = ANSWERS) {
  const rows = puzzle.rows;
  const beforeLastCount = rows.length > 1
    ? remainingAnswersForRows(rows.slice(0, -1), answers).length
    : answers.length;
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
    for (const answer of answers) {
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

export function isTrivialPuzzle(puzzle, answers = ANSWERS) {
  const features = puzzleClueFeatures(puzzle, false, answers);

  return features.correctPositions >= 4 ||
    (features.correctPositions >= 3 && features.requiredLetters >= 4) ||
    features.maxRowCorrect >= 4 ||
    (features.maxRowCorrect >= 3 && features.maxRowColored === 5);
}

export function remainingAnswersForRows(rows, answers = VALID_GUESSES) {
  return rows.reduce(
    (candidates, row) => matchingCandidates(candidates, row.word, row.pattern),
    [...answers]
  );
}

export function difficultyBandForScore(score) {
  return DIFFICULTY_BANDS.find((band) => score >= band.minScore && score < band.maxScore) ?? DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1];
}

function difficultyScoreBreakdown(features) {
  const positiveTiles = features.greenTiles + features.yellowTiles;
  const grayOnlyPressure = Math.max(0, features.grayTiles - positiveTiles);

  return Object.freeze({
    unknownLetters: features.unknownLetters * 900,
    unknownPositions: features.unknownPositions * 650,
    lateAmbiguity: Math.log2(features.beforeLastCount + 1) * 420,
    looseNearMisses: Math.log2(features.twoViolationMisses + 1) * 780,
    closeNearMisses: Math.log2(features.oneViolationMisses + 1) * 520,
    candidatePressure: Math.sqrt(features.oneViolationMisses) * 95,
    clueRows: features.rows * 120,
    exclusionLoad: grayOnlyPressure * 70,
    greenRelief: features.greenTiles * -18,
    yellowRelief: features.yellowTiles * -12,
    anchorRelief: features.maxRowCorrect * -80,
    coloredRowRelief: features.maxRowColored * -30
  });
}

export function difficultyForPuzzle(puzzle, options = {}) {
  const answers = options.candidates ?? VALID_GUESSES;
  const features = puzzleClueFeatures(puzzle, true, answers);
  const unknownPositions = 5 - features.correctPositions;
  const unknownLetters = 5 - features.requiredLetters;
  const scoreBreakdown = difficultyScoreBreakdown({ ...features, unknownLetters, unknownPositions });
  const score = Math.round(Object.values(scoreBreakdown).reduce((total, value) => total + value, 0));
  const band = difficultyBandForScore(score);

  return Object.freeze({
    score,
    band,
    scoreBreakdown,
    ...features,
    unknownLetters,
    unknownPositions
  });
}

export function buildPuzzleForTarget(targetInput, options = {}) {
  const target = normalizeWord(targetInput);
  const answers = options.answers ?? answerBankForMode(options.answerBank);
  const candidatesUniverse = options.candidates ?? VALID_GUESSES;
  const probePoolSize = options.probePoolSize ?? DEFAULT_PROBE_POOL_SIZE;
  if (!answers.includes(target) || !candidatesUniverse.includes(target)) {
    throw new Error(`Unknown answer word: ${targetInput}`);
  }

  let candidates = [...candidatesUniverse];
  const used = new Set();
  const rows = [];

  while (rows.length < 5 && candidates.length > 1) {
    const guess = rows.length === 0
      ? chooseOpeningGuess(target, used)
      : chooseInformationProbe(target, candidates, used, rows, probePoolSize);

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

  const remaining = remainingAnswersForRows(rows, candidatesUniverse);
  if (remaining.length !== 1 || remaining[0] !== target) {
    return null;
  }

  const puzzle = Object.freeze({
    answer: target,
    rows: Object.freeze(rows.map((row) => Object.freeze({ ...row, pattern: Object.freeze([...row.pattern]) }))),
    remaining: Object.freeze(remaining)
  });

  if (isTrivialPuzzle(puzzle, candidatesUniverse)) {
    return null;
  }

  return puzzle;
}

export function createPuzzle(rng = Math.random, options = {}) {
  const answers = options.answers ?? answerBankForMode(options.answerBank);
  const candidates = options.candidates ?? VALID_GUESSES;
  for (const target of shuffled(answers, rng)) {
    const puzzle = buildPuzzleForTarget(target, { ...options, answers, candidates });
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

function selectDifficultyBandSet(puzzles, seedKey = "") {
  const selected = [];
  const usedAnswers = new Set();

  for (const band of DIFFICULTY_BANDS) {
    const candidates = [];

    for (const puzzle of puzzles) {
      if (usedAnswers.has(puzzle.answer) || puzzle.difficulty.band.id !== band.id) {
        continue;
      }

      candidates.push({
        puzzle,
        targetKey: [
          Math.abs(puzzle.difficulty.score - band.targetScore),
          puzzle.difficulty.score,
          puzzle.answer
        ]
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => compareKeys(left.targetKey, right.targetKey));

    // Keep each pick central to its band, then date-seed the finalist for daily variety.
    const finalist = candidates
      .slice(0, DAILY_BAND_REPRESENTATIVE_WINDOW)
      .sort((left, right) => compareKeys(
        [
          hashString(`${seedKey}:${band.id}:${left.puzzle.answer}`),
          ...left.targetKey
        ],
        [
          hashString(`${seedKey}:${band.id}:${right.puzzle.answer}`),
          ...right.targetKey
        ]
      ))[0];

    const best = finalist.puzzle;
    selected.push(best);
    usedAnswers.add(best.answer);
  }

  return selected;
}

function createPuzzleSet(setKey, rngSeed, count, options, metadata = {}) {
  const rng = seededRandomFromString(rngSeed);
  const answers = options.answers ?? answerBankForMode(options.answerBank);
  const candidates = options.candidates ?? VALID_GUESSES;
  const usesDifficultyBands = count === DIFFICULTY_BANDS.length;
  const poolSize = options.poolSize ?? (
    usesDifficultyBands
      ? DEFAULT_DAILY_CANDIDATE_POOL_SIZE
      : Math.max(DEFAULT_DAILY_SPREAD_POOL_SIZE, count * 2)
  );
  const minPoolSize = options.minPoolSize ?? (
    usesDifficultyBands
      ? Math.min(poolSize, DEFAULT_DAILY_MIN_CANDIDATE_POOL_SIZE)
      : count
  );
  const pool = [];
  let selectedPuzzles = null;

  for (const target of shuffled(answers, rng)) {
    const puzzle = buildPuzzleForTarget(target, { ...options, answers, candidates });
    if (!puzzle) {
      continue;
    }

    pool.push({
      ...puzzle,
      difficulty: difficultyForPuzzle(puzzle, { candidates })
    });

    if (usesDifficultyBands && pool.length >= minPoolSize) {
      selectedPuzzles = selectDifficultyBandSet(pool, setKey);
      if (selectedPuzzles) {
        break;
      }
    }

    if (pool.length >= poolSize) {
      break;
    }
  }

  if (pool.length < count) {
    throw new Error(`Could only generate ${pool.length} puzzles for ${setKey}`);
  }

  const puzzles = usesDifficultyBands
    ? (selectedPuzzles ?? selectDifficultyBandSet(pool, setKey))
    : selectDifficultySpread(pool, count);

  if (!puzzles) {
    const foundBands = new Set(pool.map((puzzle) => puzzle.difficulty.band.id));
    const missing = DIFFICULTY_BANDS
      .filter((band) => !foundBands.has(band.id))
      .map((band) => band.label)
      .join(", ");
    throw new Error(`Could not generate all difficulty bands for ${setKey}; missing ${missing}`);
  }

  return Object.freeze({
    dateKey: setKey,
    ...metadata,
    puzzles: Object.freeze(puzzles.map((puzzle, index) => Object.freeze({
      ...puzzle,
      dailyNumber: index + 1,
      difficultyLabel: usesDifficultyBands ? puzzle.difficulty.band.label : difficultyLabelForRank(index, count)
    })))
  });
}

export function createDailyPuzzles(date = new Date(), count = 5, options = {}) {
  const dateKey = dateKeyForPuzzle(date);
  return createPuzzleSet(
    dateKey,
    `wordle-in-one:${dateKey}`,
    count,
    options,
    { mode: "daily" }
  );
}

export function createSeededPuzzles(seedInput, count = 5, options = {}) {
  const shareSeed = normalizeShareSeed(seedInput);

  if (shareSeed.length < 4) {
    throw new Error("Share seeds must include at least four letters or numbers");
  }

  return createPuzzleSet(
    `seed-${shareSeed}`,
    `wordle-in-one:share:${shareSeed}`,
    count,
    options,
    { mode: "seed", shareSeed }
  );
}

export { CLASSIC_ANSWERS, VALID_GUESSES };
