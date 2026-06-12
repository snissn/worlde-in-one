# Wordle in One

A tiny static Wordle clone where every calendar day has five deterministic puzzles. Each puzzle starts with enough guesses already filled in to leave exactly one valid Wordle guess, which is the classic Wordle answer. The player gets the next guess, which may be earlier than guess six.

The prefilled rows use a solver-ish hard-mode strategy: a common opener followed by entropy/minimax-style guesses chosen from the remaining candidate answers, so every green/yellow clue is reused. Trivial near-answer boards are rejected, including simple yellow-letter swaps and boards with almost every position already green. The five daily puzzles are selected from a deterministic candidate stream by filling one human-readable difficulty band each: Easy, Medium, Tricky, Hard, and Expert. Difficulty is scored from the visible clue board, including unresolved letters and positions, near-miss pressure, late ambiguity, and reliance on exclusions rather than rare-letter answer values. The final guess is entered through the Wordle-style keyboard, including its Enter and backspace keys, and daily progress is saved in localStorage. Challenge URLs such as `?seed=abc123` generate a replayable five-puzzle set that can be shared after the daily game.

Word lists are vendored from `Kinkelin/WordleCompetition` official data: 2,315 classic answer words, 10,657 additional allowed guesses, and 12,972 total valid guesses verified against the combined list. By default, daily answers are chosen from the classic answer list, but a board is only valid when the clues leave exactly one word from all 12,972 valid guesses. Refresh the vendored lists with `npm run update-wordlists`. See `THIRD_PARTY_NOTICES.md`.

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

Audit difficulty labels across generated days:

```sh
npm run audit-difficulty -- --start=2026-06-01 --days=7
```
