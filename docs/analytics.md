# Gameplay analytics

GA4 uses the existing `G-29DXR443PK` web stream in property `249057120`
(currently named `bikehelper-25f36`). Gameplay instrumentation starts with this
deployment; historical page views cannot reconstruct earlier gameplay.

## Reports

Configured in Google Analytics on September 22, 2026:

- [UX and sharing](https://analytics.google.com/analytics/web/#/a180294722p249057120/reports/explorer?collectionId=15826318510&r=15826559186): event count, total users, and event count per active user, filtered to `game_name=word_in_one`. Available breakdowns include event name, game mode, difficulty, puzzle number, reveal usage, rejection reason, sharing method/content/failure, entry point, and device category. Find it under **Reports → Word in One → UX and retention**.
- [Gameplay funnel](https://analytics.google.com/analytics/web/#/analysis/a180294722p249057120/edit/KWcZIL1QTFqxswR4TD3WRg): ready → started playing → solved a puzzle → completed all five, with device breakdown and elapsed time. Shared in Explore and also published in the Word in One report collection.
- [Visit retention](https://analytics.google.com/analytics/web/#/analysis/a180294722p249057120/edit/1iI1Ai7sThmf1bLI5AAWPw): shared daily acquisition cohort, returning on any event, last 28 days, active users. Its event segment limits page locations to the canonical and legacy game domains, including `www`.

The funnel follows users across the selected dates, not an individual attempt or
puzzle set. Visit retention measures returning visits, not returning gameplay.
Read day-1/day-7 retention only for cohorts old enough to have those days.
All reports require access to the existing property; sharing adds no new users.

## Event contract

All custom events include `game_name=word_in_one`, `game_mode=daily|challenge`,
and `used_reveal=yes|no`. Puzzle events also include `level_name` (easy, medium,
tricky, hard, expert) and `puzzle_number` (1–5).

| Event | When it fires |
| --- | --- |
| `game_ready` | The puzzle set and input handlers are ready, once per page load. |
| `game_start` | First change to an unsolved guess, submit, or reveal on this page. |
| `level_start` | First such interaction with each unsolved puzzle on this page. |
| `guess_rejected` | Invalid submit; `rejection_reason` is `too_short`, `not_in_word_list`, `locked_clue`, `excluded_letter`, or `not_answer`. |
| `answer_reveal` | Each Reveal action on an unsolved puzzle, including repeated actions. |
| `level_end` | A newly solved puzzle is saved. All level ends are successful submissions. |
| `game_complete` | The newly solved puzzle completes all five. |
| `help_open` | How it works opens; `entry_point=header`. |
| `clue_explained` | Explain a clue is selected in options; `entry_point=options`. This only explains visible evidence and does not set `used_reveal`. |
| `share_attempt` | Share invoked; `method` is native or clipboard. |
| `share` | Native sharing resolves successfully or clipboard copy succeeds. |
| `share_failed` | Native sharing is cancelled or copying fails; `failure_reason` is cancelled or unavailable. |
| `challenge_start` | New challenge navigation requested; `entry_point` is options or completion. |

Sharing includes `content_type=challenge|daily_result` and
`entry_point=header|options|completion`. A native failure may successfully fall
back to clipboard; attempts then have method native and success has method
clipboard. Cancellation is separate from a failed copy. A successful share API
call does not prove a recipient opened the invitation.

Reveal events measure action frequency; clicking Reveal again after a refresh
also counts. Use `level_end` with `used_reveal` to assess assisted solves.
Reveal usage persists across refreshes. For set events it means any puzzle in
the saved set used Reveal; for puzzle events it refers to that puzzle. Old saves
have no reveal history and default to no. Starts count resumed interactions on
each page load; completed puzzles never emit another completion on refresh.

New challenge navigation waits for the analytics callback, with a 500ms JavaScript
fallback if the tag is still loading or blocked. Missing analytics and local or
preview hosts navigate immediately. Delivery remains best effort within that cap.

## Weekly UX loop

1. Compare the same weekdays before and after one UX change. In the funnel,
   inspect ready-to-start drop-off and completion by device.
2. In UX and sharing, search `guess_rejected` and add Rejection reason or Puzzle
   difficulty as a secondary dimension. Compare affected users as well as event
   counts, so repeated taps by one player do not dominate decisions.
3. Compare `level_start`, `level_end`, and `answer_reveal` by difficulty. Filter
   `level_end` to Used reveal = no when evaluating unassisted solves. Do not treat
   event-count ratios as exact attempt conversion rates.
4. Compare `share_attempt`, `share`, and `share_failed` by entry point and device;
   inspect Share failure reason for cancellation versus unavailable sharing.
5. Check mature day-1/day-7 visit cohorts for regression. Use a copy of the cohort
   with `game_start` as the return criterion once that event is available to
   specifically investigate returning play.

Ten event-scoped custom dimensions are registered: Game name (`game_name`),
Game mode (`game_mode`), Puzzle difficulty (`level_name`), Puzzle number
(`puzzle_number`), Used reveal (`used_reveal`), Rejection reason
(`rejection_reason`), Entry point (`entry_point`), Share method (`method`), Share
content type (`content_type`), and Share failure reason (`failure_reason`).
New dimensions can take [24–48 hours after collection to become reportable](https://support.google.com/analytics/answer/14240153?hl=en).

## Collection and verification

The tag loads asynchronously only on HTTPS production game domains. Localhost
and preview hosts send no analytics. Guesses, answers, seeds, raw share payloads,
and arbitrary query parameters are excluded from our event payloads. Page URLs
retain only campaign UTM parameters; page titles and referrers omit challenge
identifiers. Google signals and ad personalization are disabled in the tag.
No dependencies, custom player IDs, or session replay are added.

Run `npm test` for actual input/share handler coverage, completion deduplication,
saved reveal attribution, payload sanitization, and disabled/broken analytics.
After deployment, use GA Realtime while playing a production puzzle to verify
`game_ready`, `game_start`, `level_start`, and a solve or rejection. Expect empty
gameplay reports until production events have been collected and processed.
