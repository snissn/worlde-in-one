import {
  ANSWERS,
  VALID_GUESSES,
  TileState,
  createDailyPuzzles,
  honorsLockedClues,
  isSolved,
  isValidGuess,
  normalizeWord,
  remainingAnswersForRows
} from "./puzzle.js";

const KEYBOARD_ROWS = Object.freeze([
  Object.freeze(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"]),
  Object.freeze(["a", "s", "d", "f", "g", "h", "j", "k", "l"]),
  Object.freeze(["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"])
]);

const KEY_STATE_PRIORITY = Object.freeze({
  [TileState.ABSENT]: 1,
  [TileState.PRESENT]: 2,
  [TileState.CORRECT]: 3
});

const STORAGE_PREFIX = "wordle-in-one-state";
const daily = createDailyPuzzles(new Date(), 5);
const savedDailyState = loadSavedDailyState(daily);
const puzzleStates = savedDailyState.states;

let activePuzzleIndex = savedDailyState.activePuzzleIndex;
let puzzle = daily.puzzles[activePuzzleIndex];

const grid = document.querySelector("#grid");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const remainingCount = document.querySelector("#remaining-count");
const guessNumber = document.querySelector("#guess-number");
const puzzleTabs = document.querySelector("#puzzle-tabs");
const dailyDate = document.querySelector("#daily-date");
const dailyTitle = document.querySelector("#daily-title");
const resetPuzzleButton = document.querySelector("#new-puzzle");
const revealButton = document.querySelector("#reveal");
const statusButton = document.querySelector("#status-button");
const settingsButton = document.querySelector("#settings-button");
const helpDrawer = document.querySelector("#help-drawer");

const finalTiles = [];
const keyboardButtons = new Map();

function solvedPattern() {
  return Array(5).fill(TileState.CORRECT);
}

function createEmptyPuzzleState() {
  return {
    guess: "",
    submitted: false,
    pattern: null,
    message: null,
    messageKind: "info"
  };
}

function storageKey(dateKey) {
  return `${STORAGE_PREFIX}:${dateKey}`;
}

function loadSavedDailyState(dailySet) {
  const fallback = {
    activePuzzleIndex: 0,
    states: dailySet.puzzles.map(() => createEmptyPuzzleState())
  };

  try {
    const raw = window.localStorage?.getItem(storageKey(dailySet.dateKey));
    if (!raw) {
      return fallback;
    }

    const saved = JSON.parse(raw);
    const answers = dailySet.puzzles.map((dailyPuzzle) => dailyPuzzle.answer);
    if (
      saved?.version !== 1 ||
      saved.dateKey !== dailySet.dateKey ||
      JSON.stringify(saved.answers) !== JSON.stringify(answers) ||
      !Array.isArray(saved.states)
    ) {
      return fallback;
    }

    const states = dailySet.puzzles.map((dailyPuzzle, index) => {
      const savedState = saved.states[index] ?? {};
      const guess = normalizeWord(savedState.guess);
      const submitted = savedState.submitted === true && guess === dailyPuzzle.answer;

      return {
        ...createEmptyPuzzleState(),
        guess,
        submitted,
        pattern: submitted ? solvedPattern() : null,
        message: submitted ? "Got it. That was the only possible answer." : null,
        messageKind: submitted ? "success" : "info"
      };
    });
    const activePuzzleIndex = Number.isInteger(saved.activePuzzleIndex) && saved.activePuzzleIndex >= 0 && saved.activePuzzleIndex < states.length
      ? saved.activePuzzleIndex
      : 0;

    return { activePuzzleIndex, states };
  } catch {
    return fallback;
  }
}

function saveDailyState() {
  try {
    window.localStorage?.setItem(storageKey(daily.dateKey), JSON.stringify({
      version: 1,
      dateKey: daily.dateKey,
      answers: daily.puzzles.map((dailyPuzzle) => dailyPuzzle.answer),
      activePuzzleIndex,
      states: puzzleStates.map((state) => ({
        guess: state.guess,
        submitted: state.submitted
      }))
    }));
  } catch {
    // localStorage can be unavailable in private browsing or locked-down embeds.
  }
}

function activeState() {
  return puzzleStates[activePuzzleIndex];
}

function renderMessage(text, kind = "info") {
  message.textContent = text;
  message.classList.toggle("error", kind === "error");
  message.classList.toggle("success", kind === "success");
}

function defaultMessage() {
  return `Exactly one answer remains for today's ${puzzle.difficultyLabel.toLowerCase()} puzzle.`;
}

function setMessage(text, kind = "info") {
  const state = activeState();
  state.message = text;
  state.messageKind = kind;
  renderMessage(text, kind);
}

function showActiveMessage() {
  const state = activeState();
  renderMessage(state.message ?? defaultMessage(), state.message ? state.messageKind : "info");
}

function formatDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function makeTile(letter = "", state = null) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.setAttribute("aria-label", letter ? `${letter.toUpperCase()} ${state ?? "empty"}` : "empty tile");

  if (letter) {
    tile.textContent = letter.toUpperCase();
    tile.classList.add("filled");
  }

  if (state) {
    tile.classList.add(state);
  }

  return tile;
}

function renderBoard() {
  grid.innerHTML = "";
  finalTiles.length = 0;

  for (const row of puzzle.rows) {
    const rowElement = document.createElement("div");
    rowElement.className = "word-row";
    rowElement.setAttribute("aria-label", `Prefilled guess ${row.word.toUpperCase()}`);

    for (let i = 0; i < 5; i += 1) {
      rowElement.append(makeTile(row.word[i], row.pattern[i]));
    }

    grid.append(rowElement);
  }

  const finalRow = document.createElement("div");
  finalRow.className = "word-row final-row";
  finalRow.setAttribute("aria-label", "Your final guess");

  for (let i = 0; i < 5; i += 1) {
    const tile = makeTile();
    finalTiles.push(tile);
    finalRow.append(tile);
  }

  grid.append(finalRow);

  const state = activeState();
  updateFinalTiles(state.guess, state.submitted ? state.pattern : null);
}

function updateFinalTiles(word, pattern = null) {
  for (let i = 0; i < finalTiles.length; i += 1) {
    const tile = finalTiles[i];
    tile.textContent = word[i]?.toUpperCase() ?? "";
    tile.className = "tile";

    if (word[i]) {
      tile.classList.add("filled");
    }

    if (pattern) {
      tile.classList.add(pattern[i]);
      tile.setAttribute("aria-label", `${word[i].toUpperCase()} ${pattern[i]}`);
    } else {
      tile.classList.toggle("active", i === word.length && word.length < 5);
      tile.setAttribute("aria-label", word[i] ? `${word[i].toUpperCase()} unsubmitted` : "empty tile");
    }
  }
}

function syncGuess(rawValue) {
  const state = activeState();
  state.guess = normalizeWord(rawValue);

  if (state.messageKind === "error") {
    state.message = null;
    state.messageKind = "info";
    showActiveMessage();
  }

  updateFinalTiles(state.guess);
  saveDailyState();
  return state.guess;
}

function keyboardRowsForActivePuzzle() {
  const state = activeState();
  return state.submitted
    ? [...puzzle.rows, { word: state.guess, pattern: state.pattern }]
    : puzzle.rows;
}

function submitGuess() {
  const state = activeState();
  if (state.submitted) {
    return;
  }

  if (state.guess.length !== 5) {
    setMessage("Not enough letters", "error");
    return;
  }

  if (!isValidGuess(state.guess)) {
    setMessage("Not in word list", "error");
    return;
  }

  if (!honorsLockedClues(state.guess, puzzle.rows)) {
    setMessage("Doesn't match the clues", "error");
    return;
  }

  if (!ANSWERS.includes(state.guess)) {
    setMessage("Valid guess, but not the one remaining answer", "error");
    return;
  }

  if (state.guess !== puzzle.answer) {
    setMessage("Not the one remaining answer", "error");
    return;
  }

  state.pattern = solvedPattern();
  state.submitted = true;
  updateFinalTiles(state.guess, state.pattern);
  updateKeyboard(keyboardRowsForActivePuzzle());
  updatePuzzleTabs();
  setKeyboardDisabled(true);
  setMessage("Got it. That was the only possible answer.", "success");
  saveDailyState();
}

function renderKeyboard() {
  keyboard.innerHTML = "";
  keyboardButtons.clear();

  for (const row of KEYBOARD_ROWS) {
    const rowElement = document.createElement("div");
    rowElement.className = "keyboard-row";

    for (const key of row) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.dataset.key = key;

      if (key === "enter") {
        button.textContent = "Enter";
        button.classList.add("wide");
        button.setAttribute("aria-label", "Submit guess");
      } else if (key === "backspace") {
        button.textContent = "⌫";
        button.classList.add("wide");
        button.setAttribute("aria-label", "Delete last letter");
      } else {
        button.textContent = key.toUpperCase();
        button.setAttribute("aria-label", `Letter ${key.toUpperCase()}`);
        keyboardButtons.set(key, button);
      }

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handleKeyboardAction(key);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          handleKeyboardAction(key);
        }
      });
      rowElement.append(button);
    }

    keyboard.append(rowElement);
  }
}

function keyboardStatesForRows(rows) {
  const states = new Map();

  for (const row of rows) {
    for (let i = 0; i < row.word.length; i += 1) {
      const letter = row.word[i];
      const state = row.pattern[i];
      const previous = states.get(letter);

      if (!previous || KEY_STATE_PRIORITY[state] > KEY_STATE_PRIORITY[previous]) {
        states.set(letter, state);
      }
    }
  }

  return states;
}

function updateKeyboard(rows) {
  const states = keyboardStatesForRows(rows);

  for (const [letter, button] of keyboardButtons.entries()) {
    button.classList.remove(TileState.ABSENT, TileState.PRESENT, TileState.CORRECT);

    const state = states.get(letter);
    if (state) {
      button.classList.add(state);
      button.setAttribute("aria-label", `Letter ${letter.toUpperCase()}, ${state}`);
    } else {
      button.setAttribute("aria-label", `Letter ${letter.toUpperCase()}`);
    }
  }
}

function setKeyboardDisabled(disabled) {
  for (const button of keyboard.querySelectorAll("button")) {
    button.disabled = disabled;
  }
}

function updatePuzzleChrome() {
  const remainingAnswers = remainingAnswersForRows(puzzle.rows).length;
  remainingCount.textContent = String(remainingAnswers);
  guessNumber.textContent = `#${puzzle.rows.length + 1}`;
  dailyDate.textContent = formatDateKey(daily.dateKey);
  dailyDate.dateTime = daily.dateKey;
  dailyTitle.textContent = `Puzzle ${puzzle.dailyNumber} of ${daily.puzzles.length} - ${puzzle.difficultyLabel}`;
}

function updatePuzzleTabs() {
  for (const button of puzzleTabs.querySelectorAll("button")) {
    const index = Number(button.dataset.index);
    const tabPuzzle = daily.puzzles[index];
    const tabState = puzzleStates[index];
    const isActive = index === activePuzzleIndex;

    button.classList.toggle("active", isActive);
    button.classList.toggle("solved", tabState.submitted && isSolved(tabState.pattern));
    button.classList.toggle("missed", tabState.submitted && !isSolved(tabState.pattern));
    button.setAttribute("aria-pressed", String(isActive));
    button.setAttribute(
      "aria-label",
      `Puzzle ${index + 1}, ${tabPuzzle.difficultyLabel}${tabState.submitted ? ", completed" : ""}`
    );
  }
}

function switchPuzzle(index) {
  activePuzzleIndex = index;
  puzzle = daily.puzzles[activePuzzleIndex];
  renderBoard();
  updatePuzzleChrome();
  updatePuzzleTabs();
  updateKeyboard(keyboardRowsForActivePuzzle());
  setKeyboardDisabled(activeState().submitted);
  showActiveMessage();
  saveDailyState();
}

function renderPuzzleTabs() {
  puzzleTabs.innerHTML = "";

  for (const [index, tabPuzzle] of daily.puzzles.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "puzzle-tab";
    button.dataset.index = String(index);
    button.innerHTML = `<span>${index + 1}</span><small>${tabPuzzle.difficultyLabel}</small>`;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      switchPuzzle(index);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        switchPuzzle(index);
      }
    });
    puzzleTabs.append(button);
  }

  updatePuzzleTabs();
}

function resetActivePuzzle() {
  puzzleStates[activePuzzleIndex] = createEmptyPuzzleState();
  switchPuzzle(activePuzzleIndex);
}

function updateSettingsButtonState() {
  if (!settingsButton || !helpDrawer) {
    return;
  }

  const isOpen = helpDrawer.open;
  settingsButton.setAttribute("aria-expanded", String(isOpen));
  settingsButton.setAttribute("aria-label", isOpen ? "Close how it works" : "Open how it works");
}

function handleKeyboardAction(action) {
  const state = activeState();
  if (state.submitted) {
    return;
  }

  if (action === "enter") {
    submitGuess();
  } else if (action === "backspace") {
    syncGuess(state.guess.slice(0, -1));
  } else if (state.guess.length < 5) {
    syncGuess(`${state.guess}${action}`);
  }
}

renderKeyboard();
renderPuzzleTabs();
switchPuzzle(0);

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLButtonElement && !event.target.classList.contains("key")) {
    return;
  }

  const state = activeState();
  if (state.submitted) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    submitGuess();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    syncGuess(state.guess.slice(0, -1));
  } else if (/^[a-z]$/i.test(event.key) && state.guess.length < 5) {
    event.preventDefault();
    syncGuess(`${state.guess}${event.key}`);
  }
});

statusButton.addEventListener("click", () => {
  const remainingAnswers = remainingAnswersForRows(puzzle.rows).length;
  setMessage(`${remainingAnswers} possible answer remains. This is guess #${puzzle.rows.length + 1}.`, "info");
});

settingsButton.addEventListener("click", () => {
  helpDrawer.open = !helpDrawer.open;
  updateSettingsButtonState();

  if (helpDrawer.open) {
    helpDrawer.scrollIntoView({ block: "nearest" });
  }
});

helpDrawer.addEventListener("toggle", updateSettingsButtonState);

resetPuzzleButton.addEventListener("click", resetActivePuzzle);
revealButton.addEventListener("click", () => {
  const state = activeState();
  if (state.submitted) {
    return;
  }

  syncGuess(puzzle.answer);
  setMessage("Answer filled in. Press Enter on the keyboard to finish the board.", "success");
  keyboard.querySelector('[data-key="enter"]')?.focus();
});
updateSettingsButtonState();
