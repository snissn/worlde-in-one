# Wordle in One

A tiny static Wordle clone where every page load starts with enough guesses already filled in to leave exactly one possible answer in the app's answer bank. The player gets the next guess, which may be earlier than guess six.

The prefilled rows use a solver-ish hard-mode strategy: a common opener followed by entropy/minimax-style guesses chosen from the remaining candidate answers, so every green/yellow clue is reused. The final guess is entered through the Wordle-style keyboard, including its Enter and backspace keys.

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
