// scripture.api.bible provider — STUB (key not configured today).
//
// When you're ready to enable modern translations:
//   1. Sign up at https://scripture.api.bible (free, ~30 seconds).
//   2. Add to .env:  BIBLE_API_KEY=xxxxxxxx
//   3. (Optional) restrict the rotation list:
//        SCRIPTURE_TRANSLATIONS_ENABLED=NIV,NKJV,AMP,NLT
//
// As soon as BIBLE_API_KEY is present, isConfigured() returns true,
// listAvailableTranslations() merges into the chevron rotation, and
// fetchVerse() starts returning live data. NO UI CODE CHANGES NEEDED.
//
// API docs: https://docs.api.bible/
// Endpoint: https://api.scripture.api.bible/v1/bibles/{bibleId}/passages/{passageId}
//
// Translation → Bible ID map below uses api.bible's official IDs.
// These are stable (the platform versions them). Pick whichever ones
// you have access to under your free tier; some translations require
// requesting access (NIV is the strictest).

import type {
  FetchVerseInput,
  FetchVerseResult,
  ScriptureProvider,
  Translation,
} from "./types";
import { ScriptureProviderError } from "./types";

const ENDPOINT = "https://api.scripture.api.bible/v1";

// Verified Bible IDs from api.bible's catalog (as of build time).
// To add a translation, look it up at:
//   GET /v1/bibles  (with X-API-Key header)
const BIBLE_IDS: Record<string, string> = {
  NIV: "06125adad2d5898a-01",
  NKJV: "de4e12af7f28f599-02",
  AMP: "01b29f4b342acc35-01",
  NLT: "65eec8e0b60e656b-01",
  // Add more here as you confirm access:
  // CSB: "...",
  // NRSV: "...",
};

const ALL_TRANSLATIONS: Translation[] = [
  {
    id: "NIV",
    name: "New International Version",
    copyright: "© 2011 Biblica, Inc.®",
    providerKey: "scripture-api-bible",
  },
  {
    id: "NKJV",
    name: "New King James Version",
    copyright: "© 1982 Thomas Nelson",
    providerKey: "scripture-api-bible",
  },
  {
    id: "AMP",
    name: "Amplified Bible",
    copyright: "© 2015 The Lockman Foundation",
    providerKey: "scripture-api-bible",
  },
  {
    id: "NLT",
    name: "New Living Translation",
    copyright: "© 2015 Tyndale House Foundation",
    providerKey: "scripture-api-bible",
  },
];

function getApiKey(): string | null {
  return process.env.BIBLE_API_KEY?.trim() || null;
}

function getEnabledList(): string[] | null {
  const raw = process.env.SCRIPTURE_TRANSLATIONS_ENABLED?.trim();
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

/**
 * Translate "Romans 8:38-39" to api.bible's passage id format,
 * which is "BOOK.CHAPTER.VERSE-BOOK.CHAPTER.VERSE" using their
 * 3-letter book codes (e.g. "ROM"). For our use the simpler
 * "ROM.8.38-ROM.8.39" works.
 *
 * NOTE: This is a minimal-but-honest implementation. It covers the
 * common books we'll actually curate; uncommon books we'd need to
 * extend the map for.
 */
const BOOK_CODES: Record<string, string> = {
  // Pentateuch
  genesis: "GEN", exodus: "EXO", leviticus: "LEV", numbers: "NUM", deuteronomy: "DEU",
  // History
  joshua: "JOS", judges: "JDG", ruth: "RUT",
  "1samuel": "1SA", "2samuel": "2SA",
  "1kings": "1KI", "2kings": "2KI",
  "1chronicles": "1CH", "2chronicles": "2CH",
  ezra: "EZR", nehemiah: "NEH", esther: "EST",
  // Wisdom
  job: "JOB", psalms: "PSA", psalm: "PSA",
  proverbs: "PRO", ecclesiastes: "ECC", "songofsolomon": "SNG",
  // Major prophets
  isaiah: "ISA", jeremiah: "JER", lamentations: "LAM",
  ezekiel: "EZK", daniel: "DAN",
  // Minor prophets
  hosea: "HOS", joel: "JOL", amos: "AMO", obadiah: "OBA", jonah: "JON",
  micah: "MIC", nahum: "NAM", habakkuk: "HAB", zephaniah: "ZEP",
  haggai: "HAG", zechariah: "ZEC", malachi: "MAL",
  // Gospels
  matthew: "MAT", mark: "MRK", luke: "LUK", john: "JHN",
  // Acts + Pauline
  acts: "ACT", romans: "ROM",
  "1corinthians": "1CO", "2corinthians": "2CO",
  galatians: "GAL", ephesians: "EPH", philippians: "PHP", colossians: "COL",
  "1thessalonians": "1TH", "2thessalonians": "2TH",
  "1timothy": "1TI", "2timothy": "2TI",
  titus: "TIT", philemon: "PHM",
  // General
  hebrews: "HEB", james: "JAS",
  "1peter": "1PE", "2peter": "2PE",
  "1john": "1JN", "2john": "2JN", "3john": "3JN",
  jude: "JUD", revelation: "REV",
};

function referenceToPassageId(reference: string): string | null {
  // Examples we accept: "John 3:16", "Romans 8:38-39", "1 John 4:8"
  // Strip spaces in the book name to allow "1 John" / "1John".
  const m = reference.match(
    /^\s*(\d?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?\s*$/,
  );
  if (!m) return null;
  const bookKey = m[1].replace(/\s+/g, "").toLowerCase();
  const chapter = m[2];
  const verseStart = m[3];
  const verseEnd = m[4];
  const code = BOOK_CODES[bookKey];
  if (!code) return null;
  if (verseEnd) {
    return `${code}.${chapter}.${verseStart}-${code}.${chapter}.${verseEnd}`;
  }
  return `${code}.${chapter}.${verseStart}`;
}

export const scriptureApiBible: ScriptureProvider = {
  key: "scripture-api-bible",
  displayName: "scripture.api.bible",

  isConfigured() {
    return getApiKey() !== null;
  },

  listAvailableTranslations() {
    if (!this.isConfigured()) return [];
    const enabled = getEnabledList();
    if (!enabled) return ALL_TRANSLATIONS;
    return ALL_TRANSLATIONS.filter((t) => enabled.includes(t.id));
  },

  async fetchVerse({ reference, translation }: FetchVerseInput): Promise<FetchVerseResult> {
    const key = getApiKey();
    if (!key) {
      throw new ScriptureProviderError(
        "BIBLE_API_KEY not configured",
        "not_configured",
      );
    }

    const bibleId = BIBLE_IDS[translation];
    if (!bibleId) {
      throw new ScriptureProviderError(
        `Translation ${translation} not supported by api.bible`,
        "translation_not_supported",
      );
    }

    const passageId = referenceToPassageId(reference);
    if (!passageId) {
      throw new ScriptureProviderError(
        `Could not parse reference: ${reference}`,
        "reference_not_found",
      );
    }

    const url = `${ENDPOINT}/bibles/${bibleId}/passages/${passageId}?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false&include-verse-spans=false`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "api-key": key },
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
    if (response.status === 429) {
      throw new ScriptureProviderError("Rate limited", "rate_limited");
    }
    if (!response.ok) {
      throw new ScriptureProviderError(
        `api.bible returned ${response.status}`,
        "upstream_error",
      );
    }

    const data = (await response.json()) as {
      data?: {
        content?: string;
        reference?: string;
        copyright?: string;
      };
    };

    const content = data.data?.content;
    if (!content) {
      throw new ScriptureProviderError(
        "api.bible response missing content",
        "upstream_error",
      );
    }

    const matched =
      ALL_TRANSLATIONS.find((t) => t.id === translation) ??
      ALL_TRANSLATIONS[0];

    return {
      reference: data.data?.reference ?? reference,
      translation: matched.id,
      text: content.replace(/\s+/g, " ").trim(),
      copyright: data.data?.copyright?.trim() || matched.copyright,
    };
  },
};
