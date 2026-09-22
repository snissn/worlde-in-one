import { canonicalAppUrl } from "./urls.js";

export function completionSharePayload(daily, puzzleStates) {
  const isChallenge = daily.mode === "seed";
  const label = isChallenge ? `Challenge ${daily.shareSeed.toUpperCase()}` : `Daily ${daily.dateKey}`;
  const title = `Word in One · ${label}`;
  const summary = puzzleStates.map((state) => state.usedReveal ? "🟨" : "🟩").join("");

  return {
    title,
    text: `${title}\n${summary} ${puzzleStates.length}/${puzzleStates.length} puzzles\n🟩 No Reveal · 🟨 Used Reveal\n${isChallenge ? "Play this challenge:" : "Play today's puzzles:"}`,
    url: canonicalAppUrl(isChallenge ? daily.shareSeed : "")
  };
}
