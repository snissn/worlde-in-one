import {
  ANSWERS,
  VALID_GUESSES,
  TileState,
  createDailyPuzzles,
  createSeededPuzzles,
  generateShareSeed,
  honorsLockedClues,
  isSolved,
  isValidGuess,
  normalizeShareSeed,
  normalizeWord,
  remainingAnswersForRows,
  violatedLockedClueTiles
} from "./puzzle.js";
import {
  loadSavedDailyState,
  saveDailyState as persistDailyState,
  solvedPattern
} from "./storage.js";

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

const MAX_TOASTS = 5;
const TOAST_DURATION_MS = 1900;

function seedFromUrl() {
  return normalizeShareSeed(new URL(window.location.href).searchParams.get("seed"));
}

const initialShareSeed = seedFromUrl();
const daily = initialShareSeed.length >= 4
  ? createSeededPuzzles(initialShareSeed, 5)
  : createDailyPuzzles(new Date(), 5);
const savedDailyState = loadSavedDailyState(daily);
const puzzleStates = savedDailyState.states;
const isSeededGame = daily.mode === "seed";

let activePuzzleIndex = savedDailyState.activePuzzleIndex;
let puzzle = daily.puzzles[activePuzzleIndex];

const grid = document.querySelector("#grid");
const keyboard = document.querySelector("#keyboard");
const toastRegion = document.querySelector("#toast-region");
const remainingCount = document.querySelector("#remaining-count");
const guessNumber = document.querySelector("#guess-number");
const puzzleTabs = document.querySelector("#puzzle-tabs");
const dailyDate = document.querySelector("#daily-date");
const seedDateLink = document.querySelector("#seed-date-link");
const dailyTitle = document.querySelector("#daily-title");
const revealButton = document.querySelector("#reveal");
const settingsButton = document.querySelector("#settings-button");
const helpButton = document.querySelector("#help-button");
const answerModal = document.querySelector("#answer-modal");
const helpModal = document.querySelector("#help-modal");
const answerCloseButton = document.querySelector("#answer-close");
const helpCloseButton = document.querySelector("#help-close");
const seedOptionDetail = document.querySelector("#seed-option-detail");
const shareSeedGameButton = document.querySelector("#share-seed-game");
const startSeedGameButton = document.querySelector("#start-seed-game");
const playMorePanel = document.querySelector("#play-more-panel");
const playMoreTitle = document.querySelector("#play-more-title");
const playMoreDetail = document.querySelector("#play-more-detail");
const shareSeedLinkButton = document.querySelector("#share-seed-link");
const newSeedGameButton = document.querySelector("#new-seed-game");

const finalTiles = [];
const clueTiles = [];
const keyboardButtons = new Map();

function syncViewportHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
    document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
  }
}

function saveDailyState() {
  persistDailyState(daily, activePuzzleIndex, puzzleStates);
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

function shakeClueTiles(locations = []) {
  for (const { rowIndex, tileIndex } of locations) {
    const tile = clueTiles[rowIndex]?.[tileIndex];
    if (!tile) {
      continue;
    }

    tile.classList.remove("clue-shake");
    void tile.offsetWidth;
    tile.classList.add("clue-shake");
    tile.addEventListener("animationend", () => tile.classList.remove("clue-shake"), { once: true });
    window.setTimeout(() => tile.classList.remove("clue-shake"), 560);
  }
}

function showInvalidGuess(text, clueLocations = []) {
  shakeFinalRow();
  shakeClueTiles(clueLocations);
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

function displaySeed(seed) {
  return seed.toUpperCase();
}

function gameLabel() {
  return isSeededGame
    ? `Challenge ${displaySeed(daily.shareSeed)}`
    : formatDateKey(daily.dateKey);
}

function seedUrl(seed) {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  return url.toString();
}

function seedForShare() {
  return isSeededGame ? daily.shareSeed : generateShareSeed();
}

function seedSharePayload(seed) {
  return {
    title: "Wordle in One Challenge",
    text: "Can you find the only possible answers?",
    url: seedUrl(seed)
  };
}

function startSeededGame(seed = generateShareSeed()) {
  window.location.assign(seedUrl(seed));
}

function isGameComplete() {
  return puzzleStates.every((state) => state.submitted && isSolved(state.pattern));
}

async function copySeedLink(seed = seedForShare()) {
  const payload = seedSharePayload(seed);

  try {
    await navigator.clipboard.writeText(payload.url);
    showToast("Challenge link copied", "success");
    return true;
  } catch {
    return false;
  }
}

async function shareSeedGame(seed = seedForShare()) {
  const payload = seedSharePayload(seed);

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
  }

  if (!(await copySeedLink(seed))) {
    showToast("Share unavailable", "error");
  }
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
  clueTiles.length = 0;

  for (const [rowIndex, row] of puzzle.rows.entries()) {
    const rowElement = document.createElement("div");
    rowElement.className = "word-row";
    rowElement.setAttribute("aria-label", `Prefilled guess ${row.word.toUpperCase()}`);
    clueTiles[rowIndex] = [];

    for (let i = 0; i < 5; i += 1) {
      const tile = makeTile(row.word[i], row.pattern[i]);
      clueTiles[rowIndex].push(tile);
      rowElement.append(tile);
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
    showInvalidGuess("Doesn't match clues", violatedLockedClueTiles(state.guess, puzzle.rows));
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
        button.append(createBackspaceIcon());
        button.classList.add("wide", "icon-key");
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

function createBackspaceIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M21 4H8l-6 8 6 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z");
  svg.append(path);

  const firstLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  firstLine.setAttribute("d", "m16 9-6 6");
  svg.append(firstLine);

  const secondLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  secondLine.setAttribute("d", "m10 9 6 6");
  svg.append(secondLine);

  return svg;
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
  if (isSeededGame) {
    const seedLabel = `Challenge ${displaySeed(daily.shareSeed)}`;
    dailyDate.hidden = true;
    dailyDate.removeAttribute("datetime");
    seedDateLink.hidden = false;
    seedDateLink.href = seedUrl(daily.shareSeed);
    seedDateLink.textContent = "Challenge";
    seedDateLink.title = seedLabel;
    seedDateLink.setAttribute("aria-label", `Share ${seedLabel} link`);
  } else {
    dailyDate.hidden = false;
    dailyDate.textContent = gameLabel();
    dailyDate.dateTime = daily.dateKey;
    seedDateLink.hidden = true;
    seedDateLink.removeAttribute("href");
    seedDateLink.removeAttribute("title");
  }
  dailyTitle.textContent = `Puzzle ${puzzle.dailyNumber} of ${daily.puzzles.length} - ${puzzle.difficultyLabel}`;
}

function updatePlayMorePanel() {
  const complete = isGameComplete();
  playMorePanel.hidden = !complete;

  if (!complete) {
    return;
  }

  if (isSeededGame) {
    playMoreTitle.textContent = "Challenge complete";
    playMoreDetail.textContent = "Share this set or start another challenge.";
    shareSeedLinkButton.hidden = false;
    shareSeedLinkButton.textContent = "Share link";
    newSeedGameButton.textContent = "New challenge";
  } else {
    playMoreTitle.textContent = "Daily complete";
    playMoreDetail.textContent = "Send a fresh challenge or keep playing.";
    shareSeedLinkButton.hidden = false;
    shareSeedLinkButton.textContent = "Share link";
    newSeedGameButton.textContent = "Play more";
  }
}

function updateSeedOptions() {
  seedOptionDetail.textContent = isSeededGame
    ? `Challenge code ${displaySeed(daily.shareSeed)}`
    : "Create a replayable five-puzzle set.";
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

  updatePlayMorePanel();
}

function renderActivePuzzle() {
  clearToasts();
  renderBoard();
  updatePuzzleChrome();
  updatePuzzleTabs();
  updateKeyboard(keyboardRowsForActivePuzzle());
  setKeyboardDisabled(activeState().submitted);
}

function switchPuzzle(index) {
  activePuzzleIndex = index;
  puzzle = daily.puzzles[activePuzzleIndex];
  renderActivePuzzle();
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
renderActivePuzzle();
updateSeedOptions();
saveDailyState();

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

shareSeedLinkButton.addEventListener("click", () => shareSeedGame());
newSeedGameButton.addEventListener("click", () => startSeededGame());
shareSeedGameButton.addEventListener("click", () => shareSeedGame());
startSeedGameButton.addEventListener("click", () => startSeededGame());
seedDateLink.addEventListener("click", (event) => {
  if (!isSeededGame) {
    return;
  }

  event.preventDefault();
  shareSeedGame(daily.shareSeed);
});

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
