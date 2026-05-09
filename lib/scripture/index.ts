// Scripture data layer (Daily Scripture feature).
//
// Public read API:
//   listScriptures(includeInactive?)            → admin-side list
//   pickRandomReference()                       → for the login page
//   getVerse({ reference, translation })        → resolves text via active provider
//
// Mutations (admin):
//   createScripture / updateScripture / deleteScripture
//   These trust the caller — the action layer (lib/cem/scripture-actions.ts)
//   is responsible for role gating (platform admin only).
//
// SECURITY:
// - cem_scriptures is PLATFORM-GLOBAL (one curated list across all
//   tenants + bare platform host). Scripture isn't sensitive data;
//   making it global means the login page works pre-auth on any URL.
// - The `reference` column is free-text; we validate format at the
//   action layer (regex). The provider abstraction also throws if a
//   reference can't be parsed, so a malformed entry never crashes
//   the login page (we fall back to a hardcoded default).
// - Verse text is NEVER stored; provider fetches every time, with a
//   short server-side cache (15 min) for performance. This sidesteps
//   any redistribution-licensing question entirely.

import "server-only";

import { unstable_cache } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cemScriptures } from "@/db/schema";
import {
  findProviderForTranslation,
  listAvailableTranslations,
  type FetchVerseResult,
  type Translation,
} from "./providers";
import { ScriptureProviderError } from "./providers/types";

const CACHE_TTL_SECONDS = 15 * 60; // 15 min — short enough to stay clearly under fair-use.

// ── Hardcoded fallback ──────────────────────────────────────────────
// Used when:
//   - the tenant has no curated scriptures yet
//   - all configured providers fail
//   - a reference lookup throws
// Always WEB (public domain) so we have nothing to apologise for.
const FALLBACK_VERSE: FetchVerseResult = {
  reference: "John 3:16",
  translation: "WEB",
  text:
    "For God so loved the world, that he gave his one and only Son, " +
    "that whoever believes in him should not perish, but have eternal life.",
  copyright: "Public Domain (World English Bible)",
};

// ── Types ───────────────────────────────────────────────────────────

export type ScriptureRow = {
  id: string;
  reference: string;
  default_translation: string;
  theme: string | null;
  active: boolean;
  created_at: Date | null;
  created_by: string | null;
};

// ── Reads (admin) ───────────────────────────────────────────────────

export async function listScriptures(
  includeInactive = false,
): Promise<ScriptureRow[]> {
  const query = db
    .select({
      id: cemScriptures.id,
      reference: cemScriptures.reference,
      default_translation: cemScriptures.default_translation,
      theme: cemScriptures.theme,
      active: cemScriptures.active,
      created_at: cemScriptures.created_at,
      created_by: cemScriptures.created_by,
    })
    .from(cemScriptures);

  const rows = includeInactive
    ? await query.orderBy(asc(cemScriptures.theme), desc(cemScriptures.created_at))
    : await query
        .where(eq(cemScriptures.active, true))
        .orderBy(asc(cemScriptures.theme), desc(cemScriptures.created_at));

  return rows.map((r) => ({
    ...r,
    default_translation: r.default_translation ?? "KJV",
    active: r.active ?? true,
  }));
}

// ── Reads (login-page hot path) ─────────────────────────────────────

/**
 * Pick a random active scripture reference. Cached for 60s to absorb
 * the burst when many anon users hit /login at once; 60s is short
 * enough that newly-added scriptures show up promptly.
 */
export const pickRandomReference = unstable_cache(
  async (): Promise<
    { reference: string; default_translation: string } | null
  > => {
    const rows = await db
      .select({
        reference: cemScriptures.reference,
        default_translation: cemScriptures.default_translation,
      })
      .from(cemScriptures)
      .where(eq(cemScriptures.active, true));
    if (rows.length === 0) return null;
    const pick = rows[Math.floor(Math.random() * rows.length)];
    return {
      reference: pick.reference,
      default_translation: pick.default_translation ?? "KJV",
    };
  },
  ["pickRandomReference"],
  { revalidate: 60, tags: ["scriptures"] },
);

/**
 * Resolve verse text for (reference, translation). Caches by the
 * tuple — same lookup within 15 minutes is instant.
 *
 * Falls back through:
 *   1. The translation's owning provider.
 *   2. ANY active provider that supports this translation (defence
 *      in depth if multiple providers expose the same id).
 *   3. The hardcoded FALLBACK_VERSE — login page is never broken.
 */
export async function getVerse({
  reference,
  translation,
}: {
  reference: string;
  translation: string;
}): Promise<FetchVerseResult> {
  return getVerseCached(reference, translation);
}

const getVerseCached = unstable_cache(
  async (
    reference: string,
    translation: string,
  ): Promise<FetchVerseResult> => {
    const provider = findProviderForTranslation(translation);
    if (!provider) {
      // Translation isn't currently available (e.g. user picked NIV
      // before the API key was set). Fall back to KJV via bible-api.
      return getVerseCached(reference, "KJV").catch(() => FALLBACK_VERSE);
    }
    try {
      return await provider.fetchVerse({ reference, translation });
    } catch (e) {
      if (
        e instanceof ScriptureProviderError &&
        e.code === "reference_not_found"
      ) {
        // Bad reference in the curated set — log and use fallback.
        console.warn("[scripture] reference not found:", reference, e.message);
        return FALLBACK_VERSE;
      }
      // Network or upstream issue. Try a different translation as a
      // last-ditch attempt (a different provider might still work).
      console.warn(
        "[scripture] provider error:",
        e instanceof Error ? e.message : String(e),
      );
      const alts = listAvailableTranslations().filter(
        (t) => t.id !== translation,
      );
      for (const alt of alts) {
        try {
          const altProvider = findProviderForTranslation(alt.id);
          if (!altProvider) continue;
          return await altProvider.fetchVerse({ reference, translation: alt.id });
        } catch {
          continue;
        }
      }
      return FALLBACK_VERSE;
    }
  },
  ["getVerse"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["scripture-verse"] },
);

// ── Mutations (caller verifies role — platform admin only) ──────────

export type ScriptureCreateInput = {
  reference: string;
  default_translation?: string;
  theme?: string | null;
  active?: boolean;
};

export async function createScripture(
  createdBy: string,
  input: ScriptureCreateInput,
): Promise<string> {
  const inserted = await db
    .insert(cemScriptures)
    .values({
      reference: input.reference,
      default_translation: input.default_translation ?? "KJV",
      theme: input.theme ?? null,
      active: input.active ?? true,
      created_by: createdBy,
    })
    .returning({ id: cemScriptures.id });
  return inserted[0].id;
}

export async function updateScripture(
  id: string,
  patch: Partial<ScriptureCreateInput>,
): Promise<void> {
  await db
    .update(cemScriptures)
    .set({
      ...(patch.reference !== undefined && { reference: patch.reference }),
      ...(patch.default_translation !== undefined && {
        default_translation: patch.default_translation,
      }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.active !== undefined && { active: patch.active }),
    })
    .where(eq(cemScriptures.id, id));
}

export async function deleteScripture(id: string): Promise<void> {
  await db.delete(cemScriptures).where(eq(cemScriptures.id, id));
}

// Re-export for the UI/admin consumers.
export { listAvailableTranslations };
export type { Translation };
