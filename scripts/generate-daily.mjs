import { mkdir, writeFile } from "node:fs/promises";

import { PREGENERATED_END_YEAR, PREGENERATED_START_YEAR } from "../src/daily-data.js";
import { createDailyPuzzles, signature } from "../src/puzzle.js";

function yearArgument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  return value === undefined ? fallback : Number(value);
}

const startYear = yearArgument("start-year", PREGENERATED_START_YEAR);
const endYear = yearArgument("end-year", PREGENERATED_END_YEAR);
if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
  throw new Error("Expected integer --start-year and --end-year values in ascending order");
}

const outputDirectory = new URL("../daily/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

for (let year = startYear; year <= endYear; year += 1) {
  const days = {};
  for (let timestamp = Date.UTC(year, 0, 1); new Date(timestamp).getUTCFullYear() === year; timestamp += 86_400_000) {
    const dateKey = new Date(timestamp).toISOString().slice(0, 10);
    const daily = createDailyPuzzles(dateKey, 5);
    days[dateKey] = daily.puzzles.map((puzzle) => [
      puzzle.answer,
      puzzle.difficultyLabel,
      puzzle.rows.map((row) => [row.word, signature(row.pattern)])
    ]);
  }

  await writeFile(new URL(`${year}.json`, outputDirectory), `${JSON.stringify({ version: 1, days })}\n`);
  console.log(`Generated daily/${year}.json`);
}
