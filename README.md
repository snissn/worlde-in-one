# Wordle in One

A tiny static Wordle clone where every page load starts with five guesses already filled in. The generated clues are checked so exactly one answer remains in the app's answer bank, and the player gets the sixth and final guess.

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
