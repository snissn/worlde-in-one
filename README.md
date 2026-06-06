# Wordle in One

A tiny static Wordle clone where every page load starts with five guesses already filled in. The generated clues are checked so exactly one answer remains in the app's answer bank, and the player gets the sixth and final guess.

The prefilled rows use a solver-ish strategy: a common opener followed by entropy/minimax-style probe words, with close near-misses when the puzzle has already been narrowed to one answer. The page also includes a Wordle-style on-screen keyboard.

## Run

```sh
npm run serve
```

Then open <http://localhost:8000>.

No build step or external dependencies are required.

## Test

```sh
npm test
```

The tests verify Wordle scoring, duplicate-letter handling, and that generated boards leave exactly one possible answer.
