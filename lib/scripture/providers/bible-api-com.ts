// bible-api.com provider — no API key required.
//
// Endpoint: https://bible-api.com/{reference}?translation={id}
// Returns JSON like:
//   { reference, verses: [...], text, translation_id, translation_name,
//     translation_note }
//
// Translations available on bible-api.com (all public-domain):
//   - kjv     King James Version (1611)
//   - web     World English Bible (modern, public domain)
//   - asv     American Standard Version (1901)
//   - bbe     Bible in Basic English
//   - darby   Darby Bible
//   - ylt     Young's Literal Translation
//   - oeb-cw  Open English Bible (Commonwealth)
//   - oeb-us  Open English Bible (US)
//
// Notes:
//   - No rate limit (bible-api.com asks for "polite use"; the 15-min
//     server cache in lib/scripture/index.ts is more than enough).
//   - Reference format is permissive: "John 3:16", "John 3:16-18",
//     "1 Cor 13:4-7" all work.
//   - Fail-fast on 4xx — bible-api.com returns 404 for unknown refs.

import type {
  FetchVerseInput,
  FetchVerseResult,
  ScriptureProvider,
  Translation,
} from "./types";
import { ScriptureProviderError } from "./types";

const ENDPOINT = "https://bible-api.com";

const TRANSLATIONS: Translation[] = [
  {
    id: "KJV",
    name: "King James Version",
    copyright: "Public Domain",
    providerKey: "bible-api-com",
  },
  {
    id: "WEB",
    name: "World English Bible",
    copyright: "Public Domain",
    providerKey: "bible-api-com",
  },
  {
    id: "ASV",
    name: "American Standard Version",
    copyright: "Public Domain (1901)",
    providerKey: "bible-api-com",
  },
];

// Map our canonical translation id (uppercase) to bible-api.com's
// query-param value (lowercase). Keep ours uppercase because that's
// what humans recognize on a UI tag.
const TRANSLATION_ID_MAP: Record<string, string> = {
  KJV: "kjv",
  WEB: "web",
  ASV: "asv",
};

export const bibleApiCom: ScriptureProvider = {
  key: "bible-api-com",
  displayName: "bible-api.com",

  isConfigured() {
    return true; // No key needed.
  },

  listAvailableTranslations() {
    return TRANSLATIONS;
  },

  async fetchVerse({ reference, translation }: FetchVerseInput): Promise<FetchVerseResult> {
    const apiTranslation = TRANSLATION_ID_MAP[translation];
    if (!apiTranslation) {
      throw new ScriptureProviderError(
        `Translation ${translation} not supported by bible-api.com`,
        "translation_not_supported",
      );
    }

    const url = `${ENDPOINT}/${encodeURIComponent(reference)}?translation=${apiTranslation}`;

    let response: Response;
    try {
      response = await fetch(url, {
        // Polite user-agent per bible-api.com guidance.
        headers: { "User-Agent": "ChurchEventManagement/1.0" },
        // Don't let stale fetches block server-side rendering forever.
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      throw new ScriptureProviderError(
        `Network error: ${e instanceof Error ? e.message : String(e)}`,
        "upstream_error",
      );
    }

    if (response.status === 404) {
      throw new ScriptureProviderError(
        `Reference not found: ${reference}`,
        "reference_not_found",
      );
    }
    if (!response.ok) {
      throw new ScriptureProviderError(
        `bible-api.com returned ${response.status}`,
        "upstream_error",
      );
    }

    const data = (await response.json()) as {
      reference?: string;
      text?: string;
      translation_id?: string;
      translation_name?: string;
      translation_note?: string;
    };

    if (!data.text) {
      throw new ScriptureProviderError(
        "bible-api.com response missing verse text",
        "upstream_error",
      );
    }

    // bible-api.com sometimes returns text with extra newlines + leading
    // verse numbers in square brackets. Clean it up: collapse whitespace,
    // trim, drop verse numbers like "1" "2" at start of lines.
    const cleanText = data.text
      .replace(/\s+/g, " ")
      .trim();

    const matched =
      TRANSLATIONS.find((t) => t.id === translation) ??
      TRANSLATIONS[0];

    return {
      reference: data.reference ?? reference,
      translation: matched.id,
      text: cleanText,
      copyright: data.translation_note ?? matched.copyright,
    };
  },
};
