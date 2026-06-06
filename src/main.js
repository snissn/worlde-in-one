import {
  ANSWERS,
  TileState,
  VALID_GUESSES,
  createPuzzle,
  isSolved,
  isValidGuess,
  normalizeWord,
  remainingAnswersForRows,
  scoreGuess
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

const puzzle = createPuzzle();
const grid = document.querySelector("#grid");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const remainingCount = document.querySelector("#remaining-count");
const newPuzzleButton = document.querySelector("#new-puzzle");
const revealButton = document.querySelector("#reveal");

const finalTiles = [];
const keyboardButtons = new Map();
let guess = "";
let submitted = false;

function setMessage(text, kind = "info") {
  message.textContent = text;
  message.classList.toggle("error", kind === "error");
  message.classList.toggle("success", kind === "success");
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
  syncGuess("");
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
  guess = normalizeWord(rawValue);
  updateFinalTiles(guess);
  return guess;
}

function submitGuess() {
  if (submitted) {
    return;
  }

  if (guess.length !== 5) {
    setMessage("Enter a five-letter word before pressing Enter.", "error");
    return;
  }

  if (!isValidGuess(guess)) {
    setMessage("That word is not in this clone's guess list.", "error");
    return;
  }

  const pattern = scoreGuess(guess, puzzle.answer);
  updateFinalTiles(guess, pattern);
  updateKeyboard([...puzzle.rows, { word: guess, pattern }]);
  submitted = true;
  setKeyboardDisabled(true);

  if (isSolved(pattern)) {
    setMessage(`Got it. ${puzzle.answer.toUpperCase()} was the only possible answer.`, "success");
  } else {
    setMessage(`Nope — the only possible answer was ${puzzle.answer.toUpperCase()}.`, "error");
  }
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

      button.addEventListener("click", () => handleKeyboardAction(key));
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

function handleKeyboardAction(action) {
  if (submitted) {
    return;
  }

  if (action === "enter") {
    submitGuess();
  } else if (action === "backspace") {
    syncGuess(guess.slice(0, -1));
  } else if (guess.length < 5) {
    syncGuess(`${guess}${action}`);
  }
}

renderBoard();
renderKeyboard();
updateKeyboard(puzzle.rows);
remainingCount.textContent = String(remainingAnswersForRows(puzzle.rows).length);
setMessage(
  `Exactly one answer remains out of ${ANSWERS.length} answers. Valid guesses: ${VALID_GUESSES.length}.`
);

document.addEventListener("keydown", (event) => {
  if (submitted) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    submitGuess();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    syncGuess(guess.slice(0, -1));
  } else if (/^[a-z]$/i.test(event.key) && guess.length < 5) {
    event.preventDefault();
    syncGuess(`${guess}${event.key}`);
  }
});

newPuzzleButton.addEventListener("click", () => window.location.reload());
revealButton.addEventListener("click", () => {
  if (submitted) {
    return;
  }

  syncGuess(puzzle.answer);
  setMessage("Answer filled in. Press Enter on the keyboard to finish the board.", "success");
});
