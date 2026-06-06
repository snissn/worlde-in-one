import { ANSWERS, VALID_GUESSES } from "./words.js";

export const TileState = Object.freeze({
  ABSENT: "absent",
  PRESENT: "present",
  CORRECT: "correct"
});

const VALID_GUESS_SET = new Set(VALID_GUESSES);

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

function countMatches(candidates, guess, pattern, stopAt = Infinity) {
  const wanted = signature(pattern);
  let count = 0;

  for (const candidate of candidates) {
    if (signature(scoreGuess(guess, candidate)) === wanted) {
      count += 1;
      if (count >= stopAt) {
        return count;
      }
    }
  }

  return count;
}

function chooseBestProbe(target, candidates, used, rng) {
  let bestCount = Infinity;
  let bestWords = [];

  for (const guess of VALID_GUESSES) {
    if (guess === target || used.has(guess)) {
      continue;
    }

    const pattern = scoreGuess(guess, target);
    const matchCount = countMatches(candidates, guess, pattern, bestCount + 1);

    if (matchCount >= candidates.length) {
      continue;
    }

    if (matchCount < bestCount) {
      bestCount = matchCount;
      bestWords = [guess];
    } else if (matchCount === bestCount) {
      bestWords.push(guess);
    }
  }

  if (bestWords.length === 0) {
    return null;
  }

  return bestWords[Math.floor(rng() * bestWords.length)];
}

function choosePaddingGuess(target, used, rng) {
  const pool = VALID_GUESSES.filter((word) => word !== target && !used.has(word));
  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(rng() * pool.length)];
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

export function buildPuzzleForTarget(targetInput, rng = Math.random) {
  const target = normalizeWord(targetInput);
  if (!ANSWERS.includes(target)) {
    throw new Error(`Unknown answer word: ${targetInput}`);
  }

  let candidates = [...ANSWERS];
  const used = new Set();
  const rows = [];

  while (rows.length < 5 && candidates.length > 1) {
    const guess = chooseBestProbe(target, candidates, used, rng);
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
    const guess = choosePaddingGuess(target, used, rng);
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
    const puzzle = buildPuzzleForTarget(target, rng);
    if (puzzle) {
      return puzzle;
    }
  }

  throw new Error("Could not generate a one-answer Wordle puzzle");
}

export { ANSWERS, VALID_GUESSES };
