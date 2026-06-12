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
const MAX_TOASTS = 5;
const TOAST_DURATION_MS = 1900;
const daily = createDailyPuzzles(new Date(), 5);
const savedDailyState = loadSavedDailyState(daily);
const puzzleStates = savedDailyState.states;

let activePuzzleIndex = savedDailyState.activePuzzleIndex;
let puzzle = daily.puzzles[activePuzzleIndex];

const grid = document.querySelector("#grid");
const keyboard = document.querySelector("#keyboard");
const toastRegion = document.querySelector("#toast-region");
const remainingCount = document.querySelector("#remaining-count");
const guessNumber = document.querySelector("#guess-number");
const puzzleTabs = document.querySelector("#puzzle-tabs");
const dailyDate = document.querySelector("#daily-date");
const dailyTitle = document.querySelector("#daily-title");
const revealButton = document.querySelector("#reveal");
const settingsButton = document.querySelector("#settings-button");
const helpButton = document.querySelector("#help-button");
const answerModal = document.querySelector("#answer-modal");
const helpModal = document.querySelector("#help-modal");
const answerCloseButton = document.querySelector("#answer-close");
const helpCloseButton = document.querySelector("#help-close");

const finalTiles = [];
const keyboardButtons = new Map();

function syncViewportHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
    document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
  }
}

function solvedPattern() {
  return Array(5).fill(TileState.CORRECT);
}

function createEmptyPuzzleState() {
  return {
    guess: "",
    submitted: false,
    pattern: null
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
        pattern: submitted ? solvedPattern() : null
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

function clearToasts() {
  toastRegion.replaceChildren();
}

function showToast(text, kind = "info") {
  while (toastRegion.children.length >= MAX_TOASTS) {
    toastRegion.firstElementChild?.remove();
  }

  const toast = document.createElement("p");
  toast.className = `toast-message ${kind}`;
  toast.textContent = text;
  toastRegion.append(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 320);
  }, TOAST_DURATION_MS);
}

function shakeFinalRow() {
  const finalRow = finalTiles[0]?.parentElement;
  if (!finalRow) {
    return;
  }

  finalRow.classList.remove("shake");
  void finalRow.offsetWidth;
  finalRow.classList.add("shake");
  finalRow.addEventListener("animationend", () => finalRow.classList.remove("shake"), { once: true });
  window.setTimeout(() => finalRow.classList.remove("shake"), 520);
}

function showInvalidGuess(text) {
  shakeFinalRow();
  showToast(text, "error");
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
    showInvalidGuess("Not enough letters");
    return;
  }

  if (!isValidGuess(state.guess)) {
    showInvalidGuess("Not in word list");
    return;
  }

  if (!honorsLockedClues(state.guess, puzzle.rows)) {
    showInvalidGuess("Doesn't match clues");
    return;
  }

  if (!ANSWERS.includes(state.guess)) {
    showInvalidGuess("Not the answer");
    return;
  }

  if (state.guess !== puzzle.answer) {
    showInvalidGuess("Not the answer");
    return;
  }

  state.pattern = solvedPattern();
  state.submitted = true;
  updateFinalTiles(state.guess, state.pattern);
  updateKeyboard(keyboardRowsForActivePuzzle());
  updatePuzzleTabs();
  setKeyboardDisabled(true);
  showToast("Got it", "success");
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
  guessNumber.textContent = `Guess #${puzzle.rows.length + 1}`;
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
  clearToasts();
  renderBoard();
  updatePuzzleChrome();
  updatePuzzleTabs();
  updateKeyboard(keyboardRowsForActivePuzzle());
  setKeyboardDisabled(activeState().submitted);
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

const modalControls = [
  {
    button: settingsButton,
    closeButton: answerCloseButton,
    modal: answerModal,
    openLabel: "Open puzzle options",
    closeLabel: "Close puzzle options"
  },
  {
    button: helpButton,
    closeButton: helpCloseButton,
    modal: helpModal,
    openLabel: "Open how it works",
    closeLabel: "Close how it works"
  }
];

function isAnyModalOpen() {
  return modalControls.some(({ modal }) => modal?.open);
}

function updateModalButtonStates() {
  for (const { button, modal, openLabel, closeLabel } of modalControls) {
    if (!button || !modal) {
      continue;
    }

    const isOpen = modal.open;
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? closeLabel : openLabel);
  }

  document.body.classList.toggle("modal-open", isAnyModalOpen());
}

function closeModal(modal) {
  if (!modal?.open) {
    return;
  }

  modal.close();
  updateModalButtonStates();
}

function closeOtherModals(nextModal) {
  for (const { modal } of modalControls) {
    if (modal !== nextModal && modal?.open) {
      modal.close();
    }
  }
}

function openModal(modal) {
  if (!modal || modal.open) {
    return;
  }

  closeOtherModals(modal);
  modal.showModal();
  updateModalButtonStates();
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

syncViewportHeight();
window.visualViewport?.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("scroll", syncViewportHeight);
window.addEventListener("resize", syncViewportHeight);

renderKeyboard();
renderPuzzleTabs();
switchPuzzle(0);

document.addEventListener("keydown", (event) => {
  if (isAnyModalOpen()) {
    return;
  }

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

for (const { button, closeButton, modal } of modalControls) {
  button?.addEventListener("click", () => {
    if (modal?.open) {
      closeModal(modal);
      return;
    }

    openModal(modal);
  });

  closeButton?.addEventListener("click", () => closeModal(modal));

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  modal?.addEventListener("close", updateModalButtonStates);
  modal?.addEventListener("cancel", updateModalButtonStates);
}

revealButton.addEventListener("click", () => {
  const state = activeState();
  if (state.submitted) {
    return;
  }

  syncGuess(puzzle.answer);
  showToast("Answer filled in");
  closeModal(answerModal);
  keyboard.querySelector('[data-key="enter"]')?.focus();
});
updateModalButtonStates();
