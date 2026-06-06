import {
  ANSWERS,
  VALID_GUESSES,
  createPuzzle,
  isSolved,
  isValidGuess,
  normalizeWord,
  remainingAnswersForRows,
  scoreGuess
} from "./puzzle.js";

const puzzle = createPuzzle();
const grid = document.querySelector("#grid");
const form = document.querySelector("#guess-form");
const input = document.querySelector("#guess-input");
const message = document.querySelector("#message");
const remainingCount = document.querySelector("#remaining-count");
const newPuzzleButton = document.querySelector("#new-puzzle");
const revealButton = document.querySelector("#reveal");

const finalTiles = [];
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

function submitGuess(event) {
  event.preventDefault();
  if (submitted) {
    return;
  }

  const guess = normalizeWord(input.value);
  input.value = guess.toUpperCase();

  if (guess.length !== 5) {
    setMessage("Enter a five-letter word.", "error");
    input.focus();
    return;
  }

  if (!isValidGuess(guess)) {
    setMessage("That word is not in this clone's guess list.", "error");
    input.focus();
    return;
  }

  const pattern = scoreGuess(guess, puzzle.answer);
  updateFinalTiles(guess, pattern);
  submitted = true;
  input.disabled = true;
  form.querySelector("button").disabled = true;

  if (isSolved(pattern)) {
    setMessage(`Got it. ${puzzle.answer.toUpperCase()} was the only possible answer.`, "success");
  } else {
    setMessage(`Nope — the only possible answer was ${puzzle.answer.toUpperCase()}.`, "error");
  }
}

renderBoard();
remainingCount.textContent = String(remainingAnswersForRows(puzzle.rows).length);
setMessage(
  `Exactly one answer remains out of ${ANSWERS.length} answers. Valid guesses: ${VALID_GUESSES.length}.`
);

input.addEventListener("input", () => {
  const guess = normalizeWord(input.value);
  input.value = guess.toUpperCase();
  updateFinalTiles(guess);
});

form.addEventListener("submit", submitGuess);
newPuzzleButton.addEventListener("click", () => window.location.reload());
revealButton.addEventListener("click", () => {
  if (submitted) {
    return;
  }

  input.value = puzzle.answer.toUpperCase();
  updateFinalTiles(puzzle.answer);
  setMessage("Answer filled in. Submit it to finish the board.", "success");
  input.focus();
});
