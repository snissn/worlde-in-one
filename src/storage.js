import { TileState, normalizeWord } from "./puzzle.js";

const STORAGE_PREFIX = "wordle-in-one-state";

export function solvedPattern() {
  return Array(5).fill(TileState.CORRECT);
}

export function createEmptyPuzzleState() {
  return {
    guess: "",
    submitted: false,
    pattern: null
  };
}

export function storageKey(dateKey) {
  return `${STORAGE_PREFIX}:${dateKey}`;
}

function getStorage(storage) {
  return storage ?? globalThis.window?.localStorage ?? globalThis.localStorage;
}

function fallbackDailyState(dailySet) {
  return {
    activePuzzleIndex: 0,
    states: dailySet.puzzles.map(() => createEmptyPuzzleState())
  };
}

function savedAnswerAt(saved, index) {
  return normalizeWord(saved.states?.[index]?.answer ?? saved.answers?.[index]);
}

function savedStatesByAnswer(saved) {
  const states = new Map();

  for (const [index, savedState] of saved.states.entries()) {
    const answer = normalizeWord(savedState.answer ?? saved.answers?.[index]);
    if (answer.length === 5 && !states.has(answer)) {
      states.set(answer, savedState);
    }
  }

  return states;
}

function savedStateForPuzzle(saved, statesByAnswer, dailyPuzzle, index) {
  const answer = normalizeWord(dailyPuzzle.answer);
  const matchedState = statesByAnswer.get(answer);

  if (matchedState) {
    return matchedState;
  }

  return savedAnswerAt(saved, index) === answer
    ? saved.states[index]
    : null;
}

function activePuzzleIndexForSavedState(saved, dailySet) {
  const savedIndex = Number.isInteger(saved.activePuzzleIndex)
    ? saved.activePuzzleIndex
    : 0;
  const activeAnswer = normalizeWord(saved.activeAnswer ?? savedAnswerAt(saved, savedIndex));

  if (activeAnswer.length === 5) {
    const answerIndex = dailySet.puzzles.findIndex((dailyPuzzle) => dailyPuzzle.answer === activeAnswer);
    if (answerIndex !== -1) {
      return answerIndex;
    }
  }

  if (
    savedIndex >= 0 &&
    savedIndex < dailySet.puzzles.length &&
    savedAnswerAt(saved, savedIndex) === dailySet.puzzles[savedIndex].answer
  ) {
    return savedIndex;
  }

  return 0;
}

export function loadSavedDailyState(dailySet, storage = null) {
  const fallback = fallbackDailyState(dailySet);

  try {
    const raw = getStorage(storage)?.getItem(storageKey(dailySet.dateKey));
    if (!raw) {
      return fallback;
    }

    const saved = JSON.parse(raw);
    if (
      saved?.version !== 1 ||
      saved.dateKey !== dailySet.dateKey ||
      !Array.isArray(saved.states)
    ) {
      return fallback;
    }

    const statesByAnswer = savedStatesByAnswer(saved);
    const states = dailySet.puzzles.map((dailyPuzzle, index) => {
      const savedState = savedStateForPuzzle(saved, statesByAnswer, dailyPuzzle, index) ?? {};
      const guess = normalizeWord(savedState.guess);
      const submitted = savedState.submitted === true && guess === dailyPuzzle.answer;

      return {
        ...createEmptyPuzzleState(),
        guess,
        submitted,
        pattern: submitted ? solvedPattern() : null
      };
    });

    return {
      activePuzzleIndex: activePuzzleIndexForSavedState(saved, dailySet),
      states
    };
  } catch {
    return fallback;
  }
}

export function saveDailyState(dailySet, activePuzzleIndex, puzzleStates, storage = null) {
  try {
    const answers = dailySet.puzzles.map((dailyPuzzle) => dailyPuzzle.answer);
    getStorage(storage)?.setItem(storageKey(dailySet.dateKey), JSON.stringify({
      version: 1,
      dateKey: dailySet.dateKey,
      answers,
      activePuzzleIndex,
      activeAnswer: answers[activePuzzleIndex] ?? null,
      states: puzzleStates.map((state, index) => ({
        answer: answers[index] ?? null,
        guess: state.guess,
        submitted: state.submitted
      }))
    }));
  } catch {
    // localStorage can be unavailable in private browsing or locked-down embeds.
  }
}
