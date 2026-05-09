// Scripture provider abstraction (Daily Scripture feature).
//
// Why an abstraction?
//   The login page renders a verse from a curated reference list. The
//   verse text comes from an upstream API. We want to be able to swap
//   APIs (free / paid / KJV-only / NIV-capable / etc.) without touching
//   any UI code. Providers therefore expose ONE interface; the active
//   provider is chosen at runtime based on env config.
//
// Today: bible-api.com (no key, public-domain translations).
// Tomorrow: scripture.api.bible (free key, NIV/NLT/NKJV/AMP).
//
// The chevron in the login UI iterates whatever the active providers
// collectively offer — KJV/WEB/ASV today, plus modern translations
// the moment BIBLE_API_KEY is set.

export type Translation = {
  /** Short canonical code displayed to the user (e.g. "KJV", "NIV"). */
  id: string;
  /** Long name shown in the admin editor / hover tooltip. */
  name: string;
  /** Public domain or licensed-with-attribution. UI shows the line. */
  copyright: string;
  /** Which provider implementation handles this translation. */
  providerKey: string;
};

export type FetchVerseInput = {
  /** Canonical reference, e.g. "Romans 8:38-39", "John 3:16". */
  reference: string;
  /** Translation id from listAvailableTranslations(). */
  translation: string;
};

export type FetchVerseResult = {
  reference: string;
  translation: string;
  text: string;
  copyright: string;
};

export interface ScriptureProvider {
  /** Stable identifier — used for routing. */
  readonly key: string;
  /** Human-readable name (admin debug only). */
  readonly displayName: string;
  /** Whether this provider is currently usable (env vars present, etc.). */
  isConfigured(): boolean;
  /** Translations this provider exposes when configured. */
  listAvailableTranslations(): Translation[];
  /** Fetch verse text. Throws on network/4xx; caller wraps with fallback. */
  fetchVerse(input: FetchVerseInput): Promise<FetchVerseResult>;
}

/** Simple error type so callers can distinguish provider-level failures. */
export class ScriptureProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "translation_not_supported"
      | "reference_not_found"
      | "rate_limited"
      | "upstream_error",
  ) {
    super(message);
    this.name = "ScriptureProviderError";
  }
}
