import { TileState } from "./puzzle.js";

// Explain only evidence already on the board; this function never receives the answer.
export function explainClue(rows) {
  for (const color of [TileState.PRESENT, TileState.CORRECT, TileState.ABSENT]) {
    for (const [rowIndex, row] of rows.entries()) {
      const position = row.pattern.indexOf(color);
      if (position < 0) continue;
      const letter = row.word[position].toUpperCase();
      const prefix = `Row ${rowIndex + 1}: `;
      if (color === TileState.PRESENT) {
        return `${prefix}yellow ${letter} means the answer contains ${letter}, but not in position ${position + 1}.`;
      }
      if (color === TileState.CORRECT) {
        return `${prefix}green ${letter} means ${letter} must stay in position ${position + 1}.`;
      }
      // Reached only when no row contains any green or yellow tiles.
      return `${prefix}gray ${letter} means ${letter} is not in the answer.`;
    }
  }
  return "Use every row together to find the one word that fits.";
}
