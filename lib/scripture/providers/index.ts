// Provider registry. ALL providers register here; the active list is
// computed at request time from each provider's isConfigured().
//
// Adding a new provider is two steps:
//   1. Implement ScriptureProvider in a new file alongside the others.
//   2. Add it to ALL_PROVIDERS below.
// Done. The login UI's chevron rotation grows automatically.

import { bibleApiCom } from "./bible-api-com";
import { scriptureApiBible } from "./scripture-api-bible";
import type { ScriptureProvider, Translation } from "./types";

export type { Translation, FetchVerseResult } from "./types";

const ALL_PROVIDERS: ScriptureProvider[] = [
  bibleApiCom,
  scriptureApiBible,
  // Add more here.
];

/** Providers that are usable in the current environment. */
export function getActiveProviders(): ScriptureProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured());
}

/** Merged translation list across active providers. Order is provider-then-list. */
export function listAvailableTranslations(): Translation[] {
  const seen = new Set<string>();
  const out: Translation[] = [];
  for (const p of getActiveProviders()) {
    for (const t of p.listAvailableTranslations()) {
      // Defensive: same translation id from two providers — keep first.
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/** Find which provider serves a given translation id. Null if none. */
export function findProviderForTranslation(
  translationId: string,
): ScriptureProvider | null {
  for (const p of getActiveProviders()) {
    if (p.listAvailableTranslations().some((t) => t.id === translationId)) {
      return p;
    }
  }
  return null;
}
