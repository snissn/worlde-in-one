import { writeFile } from "node:fs/promises";

const SOURCE_BASE = "https://raw.githubusercontent.com/Kinkelin/WordleCompetition/main/data/official";
const SOURCES = Object.freeze({
  answers: "shuffled_real_wordles.txt",
  allowed: "official_allowed_guesses.txt",
  combined: "combined_wordlist.txt"
});

async function fetchWords(filename) {
  const url = `${SOURCE_BASE}/${filename}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const words = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  for (const word of words) {
    if (!/^[a-z]{5}$/.test(word)) {
      throw new Error(`${filename} contains invalid word: ${word}`);
    }
  }

  if (new Set(words).size !== words.length) {
    throw new Error(`${filename} contains duplicate words`);
  }

  return words;
}

function formatArray(name, words) {
  const lines = [`const ${name} = [`];
  for (let i = 0; i < words.length; i += 8) {
    const chunk = words.slice(i, i + 8).map((word) => JSON.stringify(word)).join(", ");
    const comma = i + 8 >= words.length ? "" : ",";
    lines.push(`  ${chunk}${comma}`);
  }
  lines.push("];\n");
  return lines.join("\n");
}

const [answers, allowed, combined] = await Promise.all([
  fetchWords(SOURCES.answers),
  fetchWords(SOURCES.allowed),
  fetchWords(SOURCES.combined)
]);

const union = new Set([...answers, ...allowed]);
const combinedSet = new Set(combined);
const missingFromCombined = [...union].filter((word) => !combinedSet.has(word));
const missingFromUnion = combined.filter((word) => !union.has(word));

if (answers.length !== 2315) {
  throw new Error(`Expected 2315 answer words, got ${answers.length}`);
}
if (allowed.length !== 10657) {
  throw new Error(`Expected 10657 additional guesses, got ${allowed.length}`);
}
if (combined.length !== 12972) {
  throw new Error(`Expected 12972 combined words, got ${combined.length}`);
}
if (missingFromCombined.length || missingFromUnion.length) {
  throw new Error(
    `Combined word list mismatch: missingFromCombined=${missingFromCombined.length}, missingFromUnion=${missingFromUnion.length}`
  );
}

const generated = `// Official Wordle word lists vendored from Kinkelin/WordleCompetition.\n// Source directory: ${SOURCE_BASE}\n// - ANSWER_WORDS: ${SOURCES.answers} (${answers.length} words; shuffled to avoid solution-order spoilers)\n// - EXTRA_GUESSES: ${SOURCES.allowed} (${allowed.length} additional allowed guesses)\n// - The union is verified against ${SOURCES.combined} (${combined.length} total valid guesses).\n\n${formatArray("ANSWER_WORDS", answers)}${formatArray("EXTRA_GUESSES", allowed)}function uniqueWords(words, label) {\n  const seen = new Set();\n  const unique = [];\n\n  for (const word of words) {\n    if (!/^[a-z]{5}$/.test(word)) {\n      throw new Error(\`${"${label}"} contains an invalid word: ${"${word}"}\`);\n    }\n\n    if (!seen.has(word)) {\n      seen.add(word);\n      unique.push(word);\n    }\n  }\n\n  return Object.freeze(unique);\n}\n\nexport const ANSWERS = uniqueWords(ANSWER_WORDS, "ANSWERS");\nexport const VALID_GUESSES = uniqueWords([...ANSWER_WORDS, ...EXTRA_GUESSES], "VALID_GUESSES");\n`;

await writeFile(new URL("../src/words.js", import.meta.url), generated);
console.log(`Wrote src/words.js with ${answers.length} answers and ${combined.length} valid guesses.`);
