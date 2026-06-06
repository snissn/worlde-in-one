import { ANSWERS, VALID_GUESSES } from "./words.js";

export const TileState = Object.freeze({
  ABSENT: "absent",
  PRESENT: "present",
  CORRECT: "correct"
});

const VALID_GUESS_SET = new Set(VALID_GUESSES);
const STARTER_WORDS = Object.freeze(["crane", "slate", "trace", "roast", "adieu"]);

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

function chooseInformationProbe(target, candidates, used, avoidSingleton = false) {
  const candidateSet = new Set(candidates);
  let best = null;
  let bestKey = null;

  for (const guess of VALID_GUESSES) {
    if (guess === target || used.has(guess)) {
      continue;
    }

    const metrics = solverMetrics(candidates, guess);
    const pattern = scoreGuess(guess, target);
    const nextCount = metrics.counts.get(signature(pattern)) ?? 0;

    if (nextCount >= candidates.length) {
      continue;
    }

    const candidatePenalty = candidateSet.has(guess) ? 0 : 1;
    const singletonPenalty = avoidSingleton && nextCount === 1 ? 1 : 0;
    const key = [
      singletonPenalty,
      Math.round(metrics.expectedRemaining * 1000),
      metrics.worstBucket,
      nextCount,
      candidates.length <= 8 ? candidatePenalty : 0,
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

function chooseNearMissGuess(target, used) {
  let best = null;
  let bestKey = null;

  for (const guess of VALID_GUESSES) {
    if (guess === target || used.has(guess)) {
      continue;
    }

    const pattern = scoreGuess(guess, target);
    if (isSolved(pattern)) {
      continue;
    }

    const correct = pattern.filter((state) => state === TileState.CORRECT).length;
    const present = pattern.filter((state) => state === TileState.PRESENT).length;
    const repeatedLetters = guess.length - new Set(guess).size;
    const key = [
      -(correct * 4 + present * 2),
      pattern.filter((state) => state === TileState.ABSENT).length,
      repeatedLetters,
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

export function remainingAnswersForRows(rows, answers = ANSWERS) {
  return rows.reduce(
    (candidates, row) => matchingCandidates(candidates, row.word, row.pattern),
    [...answers]
  );
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
      : chooseInformationProbe(target, candidates, used, rows.length < 4);

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

  while (rows.length < 5) {
    const guess = chooseNearMissGuess(target, used);
    if (!guess) {
      return null;
    }

    rows.push({ word: guess, pattern: scoreGuess(guess, target) });
    used.add(guess);
  }

  const remaining = remainingAnswersForRows(rows);
  if (remaining.length !== 1 || remaining[0] !== target) {
    return null;
  }

  return Object.freeze({
    answer: target,
    rows: Object.freeze(rows.map((row) => Object.freeze({ ...row, pattern: Object.freeze([...row.pattern]) }))),
    remaining: Object.freeze(remaining)
  });
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

export { ANSWERS, VALID_GUESSES };
