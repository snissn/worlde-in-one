# Word in One

A tiny static five-letter word game where every calendar day has five deterministic puzzles. Each puzzle starts with enough guesses already filled in to leave exactly one valid guess, which is the classic answer. The player gets the next guess, which may be earlier than guess six.

The prefilled rows use a solver-ish hard-mode strategy: a common opener followed by entropy/minimax-style guesses chosen from the remaining candidate answers, so every green/yellow clue is reused. The five daily puzzles fill one difficulty band each: Easy, Medium, Tricky, Hard, and Expert. Easy additionally requires a familiar answer with no repeated letters, exactly three green positions, four of the five letters revealed, and at most three clue rows. That leaves one letter to discover and two positions to resolve. Simple yellow-letter swaps and four-green boards are still rejected. The other bands reject trivial near-answer boards and use scores from the visible clues, including unresolved letters and positions, near-miss pressure, late ambiguity, and reliance on exclusions rather than rare-letter answer values. The final guess is entered through the on-screen keyboard, including its Enter and backspace keys, and daily progress is saved in localStorage. Challenge URLs such as `?seed=abc234` generate a replayable five-puzzle set with the same Easy rule; daily challenge links are derived from the date plus a sequence number so the same nth challenge is shared by everyone that day.

Word lists are vendored from `Kinkelin/WordleCompetition` official data: 2,315 classic answer words, 10,657 additional allowed guesses, and 12,972 total valid guesses verified against the combined list. By default, daily answers are chosen from the classic answer list, but a board is only valid when the clues leave exactly one word from all 12,972 valid guesses. Refresh the vendored lists with `npm run update-wordlists`. See `THIRD_PARTY_NOTICES.md`.

## Run

```sh
npm run serve
```

Then open <http://localhost:8000>.

No build step or external dependencies are required.

See [Gameplay analytics](docs/analytics.md) for the GA4 reports, event definitions,
and weekly UX/retention review workflow.

Daily puzzle sets for 2026 through 2040 are committed as annual files and loaded one year at a time. Challenge links, dates outside that range, and failed data requests use the same generator in the browser as a fallback. Regenerate the files after changing puzzle generation or the word lists:

```sh
npm run generate-daily -- --start-year=2026 --end-year=2040
```

## Test

```sh
npm test
```

The tests verify tile scoring, duplicate-letter handling, and that generated boards leave exactly one possible answer.

Audit difficulty labels across generated days:

```sh
npm run audit-difficulty -- --start=2026-06-01 --days=7
```
