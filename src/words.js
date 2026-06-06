const ANSWER_WORDS = [
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult",
  "after", "again", "agent", "agree", "ahead", "alarm", "album", "alert",
  "alien", "alike", "alive", "allow", "alone", "alter", "among", "anger",
  "angle", "angry", "apart", "apple", "apply", "arena", "argue", "arise",
  "armor", "array", "aside", "asset", "audio", "audit", "avoid", "award",
  "aware", "badly", "baker", "basic", "beach", "beard", "beast", "began",
  "begin", "begun", "being", "below", "bench", "birth", "black", "blame",
  "blind", "block", "blood", "board", "boast", "bonus", "boost", "booth",
  "bound", "brain", "brand", "bread", "break", "brick", "bride", "brief",
  "bring", "broad", "broke", "brown", "brush", "build", "built", "cable",
  "carry", "catch", "cause", "chain", "chair", "chaos", "charm", "chart",
  "chase", "cheap", "check", "chest", "chief", "child", "choir", "civil",
  "claim", "class", "clean", "clear", "clerk", "click", "climb", "clock",
  "close", "cloth", "cloud", "coach", "coast", "could", "count", "court",
  "cover", "craft", "crash", "cream", "crime", "cross", "crowd", "crown",
  "daily", "dance", "dated", "dealt", "death", "depth", "doing", "doubt",
  "dozen", "draft", "drama", "dream", "dress", "dried", "drink", "drive",
  "earth", "eight", "elite", "empty", "enemy", "enjoy", "enter", "equal",
  "error", "event", "every", "exact", "exist", "extra", "faith", "false",
  "fault", "fiber", "field", "fifth", "fifty", "fight", "final", "first",
  "flame", "flash", "fleet", "floor", "focus", "force", "forth", "found",
  "frame", "fresh", "front", "fruit", "fully", "giant", "given", "glass",
  "globe", "going", "grace", "grade", "grain", "grand", "grant", "grass",
  "green", "group", "grown", "guard", "guest", "guide", "habit", "happy",
  "heart", "heavy", "hence", "honor", "horse", "hotel", "house", "human",
  "ideal", "image", "index", "inner", "input", "issue", "joint", "judge",
  "known", "label", "large", "later", "laugh", "layer", "learn", "least",
  "leave", "legal", "level", "light", "limit", "local", "logic", "loose",
  "lower", "lucky", "lunch", "magic", "major", "maker", "march", "match",
  "maybe", "mayor", "metal", "might", "minor", "model", "money", "month",
  "moral", "motor", "mount", "mouse", "mouth", "movie", "music", "never",
  "night", "noise", "north", "novel", "nurse", "ocean", "offer", "often",
  "order", "other", "ought", "paint", "panel", "party", "peace", "phase",
  "phone", "photo", "piece", "pilot", "pitch", "place", "plain", "plane",
  "plant", "plate", "point", "pound", "power", "press", "price", "pride",
  "prime", "print", "prior", "prize", "proof", "proud", "queen", "quick",
  "quiet", "quite", "radio", "raise", "range", "rapid", "ratio", "reach",
  "ready", "refer", "right", "rival", "river", "rough", "round", "route",
  "royal", "rural", "scale", "scene", "scope", "score", "sense", "serve",
  "seven", "shall", "shape", "share", "sharp", "sheet", "shelf", "shell",
  "shift", "shirt", "shock", "shoot", "short", "shown", "sight", "skill",
  "sleep", "slice", "slope", "smart", "smile", "solid", "solve", "sound",
  "south", "space", "spare", "speak", "speed", "spend", "spent", "split",
  "sport", "squad", "staff", "stage", "stand", "start", "state", "steam",
  "steel", "still", "stock", "stone", "stood", "store", "storm", "story",
  "strip", "stuck", "study", "stuff", "style", "sugar", "table", "taken",
  "taste", "teach", "thank", "their", "theme", "there", "thick", "thing",
  "think", "third", "those", "three", "threw", "throw", "tight", "today",
  "topic", "total", "touch", "tough", "tower", "track", "trade", "train",
  "treat", "trend", "trial", "tried", "trust", "truth", "twice", "under",
  "union", "unity", "until", "upper", "upset", "urban", "usage", "usual",
  "vague", "valid", "value", "video", "visit", "vital", "voice", "waste",
  "watch", "water", "wheel", "where", "which", "while", "white", "whole",
  "whose", "woman", "world", "worry", "worth", "would", "write", "wrong",
  "wrote", "yield", "young"
];

const EXTRA_GUESSES = [
  "adieu", "aisle", "antic", "azure", "cadet", "canoe", "crane", "crest",
  "crony", "fjord", "fuzzy", "glyph", "hinge", "humid", "jazzy", "knelt",
  "lynch", "nymph", "omega", "pious", "plumb", "quest", "roast", "saute",
  "shard", "slate", "stern", "trace", "truly", "vixen", "wharf", "xylem"
];

function uniqueWords(words, label) {
  const seen = new Set();
  const unique = [];

  for (const word of words) {
    if (!/^[a-z]{5}$/.test(word)) {
      throw new Error(`${label} contains an invalid word: ${word}`);
    }

    if (!seen.has(word)) {
      seen.add(word);
      unique.push(word);
    }
  }

  return Object.freeze(unique.sort());
}

export const ANSWERS = uniqueWords(ANSWER_WORDS, "ANSWERS");
export const VALID_GUESSES = uniqueWords([...ANSWER_WORDS, ...EXTRA_GUESSES], "VALID_GUESSES");
