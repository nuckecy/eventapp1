// Fuzzy name matching for the Unmapped Birthday Pool (F12).
//
// Used at admin-time to suggest possible matches between a legacy
// unmapped record (e.g. "Mary Johnson") and an existing user
// ("Sister Mary Johnson"). Pure functions — no DB / no I/O.
//
// Algorithm: case-insensitive token-overlap with a substring fallback.
// Returns a 0-100 confidence score. Anything ≥60 is a sensible
// suggestion; admin always confirms before mapping.

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const HONORIFICS = new Set([
  "sister", "brother", "pastor", "elder", "deacon", "deaconess",
  "rev", "reverend", "bishop", "minister", "mr", "mrs", "ms", "miss", "dr",
]);

function tokensWithoutHonorifics(s: string): string[] {
  return normalize(s).filter((t) => !HONORIFICS.has(t));
}

/**
 * Score 0-100. Higher means more likely to be the same person.
 *
 *  - Equal full strings (after normalisation) → 100
 *  - Equal name tokens with one side honorific-stripped → 95
 *  - All tokens of the shorter set are present in the longer → 80
 *  - At least one shared token of length ≥ 4 (typically a surname) → 60
 *  - Otherwise → 0
 */
export function nameMatchScore(a: string, b: string): number {
  const aTokens = normalize(a);
  const bTokens = normalize(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  if (aTokens.join(" ") === bTokens.join(" ")) return 100;

  const aClean = tokensWithoutHonorifics(a);
  const bClean = tokensWithoutHonorifics(b);
  if (aClean.length > 0 && bClean.length > 0 && aClean.join(" ") === bClean.join(" ")) {
    return 95;
  }

  const aSet = new Set(aClean.length ? aClean : aTokens);
  const bSet = new Set(bClean.length ? bClean : bTokens);
  const [smaller, larger] = aSet.size <= bSet.size ? [aSet, bSet] : [bSet, aSet];
  const allShared = Array.from(smaller).every((t) => larger.has(t));
  if (allShared && smaller.size > 0) return 80;

  // At least one substantive shared token (length ≥ 4).
  for (const t of smaller) {
    if (t.length >= 4 && larger.has(t)) return 60;
  }

  return 0;
}

export type MatchCandidate = { id: string; name: string };

/** Return the best-scoring candidate from `candidates` against
 *  `target`, or null when nothing scores at or above `threshold`. */
export function bestMatch(
  target: string,
  candidates: MatchCandidate[],
  threshold = 60,
): { candidate: MatchCandidate; score: number } | null {
  let best: { candidate: MatchCandidate; score: number } | null = null;
  for (const c of candidates) {
    const score = nameMatchScore(target, c.name);
    if (score < threshold) continue;
    if (!best || score > best.score) best = { candidate: c, score };
  }
  return best;
}
