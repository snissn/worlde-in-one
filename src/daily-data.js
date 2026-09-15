import { DIFFICULTY_BANDS, TileState, dateKeyForPuzzle } from "./puzzle.js";

const PATTERN_STATES = Object.freeze({
  a: TileState.ABSENT,
  p: TileState.PRESENT,
  c: TileState.CORRECT
});
const WORD_PATTERN = /^[a-z]{5}$/;
const TILE_PATTERN = /^[apc]{5}$/;

export function decodeDailyPuzzles(payload, dateKey) {
  const encodedPuzzles = payload?.version === 1 ? payload.days?.[dateKey] : null;
  if (!Array.isArray(encodedPuzzles) || encodedPuzzles.length !== DIFFICULTY_BANDS.length) {
    throw new Error(`Missing pre-generated puzzles for ${dateKey}`);
  }

  const puzzles = encodedPuzzles.map((encoded, index) => {
    const [answer, difficultyLabel, encodedRows] = Array.isArray(encoded) ? encoded : [];
    if (encoded?.length !== 3 || !WORD_PATTERN.test(answer) || difficultyLabel !== DIFFICULTY_BANDS[index].label ||
      !Array.isArray(encodedRows) || encodedRows.length < 1 || encodedRows.length > 5) {
      throw new Error(`Invalid pre-generated puzzle for ${dateKey}`);
    }

    const rows = encodedRows.map((row) => {
      const [word, pattern] = Array.isArray(row) ? row : [];
      if (row?.length !== 2 || !WORD_PATTERN.test(word) || !TILE_PATTERN.test(pattern)) {
        throw new Error(`Invalid pre-generated row for ${dateKey}`);
      }
      return Object.freeze({
        word,
        pattern: Object.freeze([...pattern].map((tile) => PATTERN_STATES[tile]))
      });
    });

    return Object.freeze({
      answer,
      rows: Object.freeze(rows),
      dailyNumber: index + 1,
      difficultyLabel
    });
  });

  return Object.freeze({
    dateKey,
    mode: "daily",
    puzzles: Object.freeze(puzzles)
  });
}

export async function loadPregeneratedDailyPuzzles(date = new Date(), fetchImpl = globalThis.fetch) {
  const dateKey = dateKeyForPuzzle(date);
  if (typeof fetchImpl !== "function") {
    return null;
  }

  try {
    const response = await fetchImpl(`/daily/${dateKey.slice(0, 4)}.json`);
    if (!response.ok) {
      return null;
    }
    return decodeDailyPuzzles(await response.json(), dateKey);
  } catch {
    return null;
  }
}
