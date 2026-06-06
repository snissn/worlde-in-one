import {
  ANSWERS,
  TileState,
  createDailyPuzzles,
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

const daily = createDailyPuzzles(new Date(), 5);
const puzzleStates = daily.puzzles.map(() => ({
  guess: "",
  submitted: false,
  pattern: null,
  message: null,
  messageKind: "info"
}));

let activePuzzleIndex = 0;
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

const finalTiles = [];
const keyboardButtons = new Map();

function activeState() {
  return puzzleStates[activePuzzleIndex];
}

function renderMessage(text, kind = "info") {
  message.textContent = text;
  message.classList.toggle("error", kind === "error");
  message.classList.toggle("success", kind === "success");
}

function defaultMessage() {
  return `Exactly one answer remains out of ${ANSWERS.length} answers. This is today's ${puzzle.difficultyLabel.toLowerCase()} puzzle.`;
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

  if (!isValidGuess(state.guess) || state.guess !== puzzle.answer) {
    setMessage("Not in word list", "error");
    return;
  }

  state.pattern = Array(5).fill(TileState.CORRECT);
  state.submitted = true;
  updateFinalTiles(state.guess, state.pattern);
  updateKeyboard(keyboardRowsForActivePuzzle());
  updatePuzzleTabs();
  setKeyboardDisabled(true);
  setMessage("Got it. That was the only possible answer.", "success");
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
  remainingCount.textContent = String(remainingAnswersForRows(puzzle.rows).length);
  guessNumber.textContent = `#${puzzle.rows.length + 1}`;
  dailyDate.textContent = `Daily ${formatDateKey(daily.dateKey)}`;
  dailyTitle.textContent = `Puzzle ${puzzle.dailyNumber} of ${daily.puzzles.length} · ${puzzle.difficultyLabel}`;
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
  puzzleStates[activePuzzleIndex] = {
    guess: "",
    submitted: false,
    pattern: null,
    message: null,
    messageKind: "info"
  };
  switchPuzzle(activePuzzleIndex);
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

resetPuzzleButton.addEventListener("click", resetActivePuzzle);
revealButton.addEventListener("click", () => {
  const state = activeState();
  if (state.submitted) {
    return;
  }

  syncGuess(puzzle.answer);
  setMessage("Answer filled in. Press Enter on the keyboard to finish the board.", "success");
});
