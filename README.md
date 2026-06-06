# Wordle in One

A tiny static Wordle clone where every calendar day has five deterministic puzzles. Each puzzle starts with enough guesses already filled in to leave exactly one possible answer in the app's answer bank. The player gets the next guess, which may be earlier than guess six.

The prefilled rows use a solver-ish hard-mode strategy: a common opener followed by entropy/minimax-style guesses chosen from the remaining candidate answers, so every green/yellow clue is reused. Trivial near-answer boards are rejected, including simple yellow-letter swaps and boards with almost every position already green. The five daily puzzles are selected from a deterministic candidate pool, scored with a difficulty heuristic, boosted by Scrabble letter values for rare-letter answers, and sorted easiest to hardest. The final guess is entered through the Wordle-style keyboard, including its Enter and backspace keys.

Word lists are vendored from the MIT-licensed `wordle-words` package: 2,315 answer words and 12,972 total valid guesses. See `THIRD_PARTY_NOTICES.md`.

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
