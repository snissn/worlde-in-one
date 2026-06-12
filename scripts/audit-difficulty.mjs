#!/usr/bin/env node

import { createDailyPuzzles } from "../src/puzzle.js";

function parseArgs(argv) {
  const options = {
    days: 7,
    json: false,
    start: new Date().toISOString().slice(0, 10)
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }

    const [key, value] = arg.split("=");
    if (key === "--start") {
      options.start = value;
    } else if (key === "--days") {
      options.days = Number(value);
    } else if (key === "--pool-size") {
      options.poolSize = Number(value);
    } else if (key === "--min-pool-size") {
      options.minPoolSize = Number(value);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.start)) {
    throw new Error("--start must look like YYYY-MM-DD");
  }
  if (!Number.isInteger(options.days) || options.days < 1) {
    throw new Error("--days must be a positive integer");
  }

  return options;
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function puzzleSummary(puzzle) {
  const difficulty = puzzle.difficulty;
  return {
    dateNumber: puzzle.dailyNumber,
    label: puzzle.difficultyLabel,
    answer: puzzle.answer,
    score: difficulty.score,
    clueRows: difficulty.rows,
    unknownLetters: difficulty.unknownLetters,
    unknownPositions: difficulty.unknownPositions,
    beforeLastCount: difficulty.beforeLastCount,
    closeNearMisses: difficulty.oneViolationMisses,
    looseNearMisses: difficulty.twoViolationMisses,
    greenTiles: difficulty.greenTiles,
    yellowTiles: difficulty.yellowTiles,
    grayTiles: difficulty.grayTiles
  };
}

function renderMarkdown(days) {
  for (const day of days) {
    console.log(`## ${day.dateKey}`);
    console.log("| Band | Answer | Score | Rows | Unknown letters | Unknown positions | Before last | Close misses | Loose misses |");
    console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

    for (const puzzle of day.puzzles) {
      console.log([
        `| ${puzzle.label}`,
        puzzle.answer,
        puzzle.score,
        puzzle.clueRows,
        puzzle.unknownLetters,
        puzzle.unknownPositions,
        puzzle.beforeLastCount,
        puzzle.closeNearMisses,
        `${puzzle.looseNearMisses} |`
      ].join(" | "));
    }

    console.log("");
  }
}

const options = parseArgs(process.argv.slice(2));
const generationOptions = {};
if (Number.isInteger(options.poolSize)) {
  generationOptions.poolSize = options.poolSize;
}
if (Number.isInteger(options.minPoolSize)) {
  generationOptions.minPoolSize = options.minPoolSize;
}

const days = [];
const startedAt = performance.now();
for (let index = 0; index < options.days; index += 1) {
  const dateKey = addDays(options.start, index);
  const daily = createDailyPuzzles(dateKey, 5, generationOptions);
  days.push({
    dateKey,
    puzzles: daily.puzzles.map(puzzleSummary)
  });
}

if (options.json) {
  console.log(JSON.stringify({
    days,
    elapsedMs: Math.round(performance.now() - startedAt)
  }, null, 2));
} else {
  renderMarkdown(days);
  console.log(`Generated ${days.length} day(s) in ${Math.round(performance.now() - startedAt)}ms.`);
}
