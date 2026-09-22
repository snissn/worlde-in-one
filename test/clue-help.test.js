import test from "node:test";
import assert from "node:assert/strict";
import { explainClue } from "../src/clue-help.js";
import { scoreGuess } from "../src/puzzle.js";

test("clue help explains visible evidence, including a repeated letter with a gray copy", () => {
  const row = (word, answer) => ({ word, pattern: scoreGuess(word, answer) });
  assert.equal(explainClue([row("array", "cigar")]),
    "Row 1: yellow R means the answer contains R, but not in position 2.");
  assert.equal(explainClue([row("couch", "cigar")]),
    "Row 1: green C means C must stay in position 1.");
  assert.equal(explainClue([row("blunt", "cigar")]),
    "Row 1: gray B means B is not in the answer.");
  assert.doesNotMatch(explainClue([row("array", "cigar")]), /CIGAR/i);
});
