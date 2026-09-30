import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { EASY_DAILY_START_DATE, dailyUsesEasyOpening } from "../src/puzzle.js";

test("the daily activation date is fixed at October 1, 2026", () => {
  assert.equal(EASY_DAILY_START_DATE, "2026-10-01");
  assert.equal(dailyUsesEasyOpening("2026-09-30"), false);
  assert.equal(dailyUsesEasyOpening("2026-10-01"), true);
  assert.equal(dailyUsesEasyOpening(new Date(2026, 8, 30, 23, 59, 59)), false);
  assert.equal(dailyUsesEasyOpening(new Date(2026, 9, 1, 0, 0, 0)), true);
});

test("the daily activation follows the player's local midnight rather than UTC", () => {
  const moduleUrl = new URL("../src/puzzle.js", import.meta.url).href;
  const script = `
    import { dateKeyForPuzzle, dailyUsesEasyOpening } from ${JSON.stringify(moduleUrl)};
    const times = ["2026-10-01T09:59:59Z", "2026-10-01T10:00:00Z"];
    console.log(JSON.stringify(times.map(time => {
      const date = new Date(time);
      return [dateKeyForPuzzle(date), dailyUsesEasyOpening(date)];
    })));
  `;
  const inTimezone = (timezone) => JSON.parse(execFileSync(process.execPath,
    ["--input-type=module", "-e", script], {
      encoding: "utf8", env: { ...process.env, TZ: timezone }
    }));

  assert.deepEqual(inTimezone("Pacific/Honolulu"), [
    ["2026-09-30", false], ["2026-10-01", true]
  ]);
  assert.deepEqual(inTimezone("America/Los_Angeles"), [
    ["2026-10-01", true], ["2026-10-01", true]
  ]);
});
