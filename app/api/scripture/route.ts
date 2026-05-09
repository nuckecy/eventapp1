// Public scripture endpoint — used by the login page client to swap
// translations and refresh verses without a full reload.
//
// SECURITY:
// - Public (pre-auth) by design. The login page is anonymous.
// - cem_scriptures is platform-global; no tenant context required.
//   This endpoint works on bare localhost AND tenant subdomains
//   identically.
// - All inputs validated with Zod.
// - Verse text comes from upstream providers; we never trust user
//   input as a Bible reference (the provider's reference parser is
//   the gate before any external request).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  getVerse,
  listAvailableTranslations,
  pickRandomReference,
} from "@/lib/scripture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  ref: z.string().trim().min(1).max(64).optional(),
  tr: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9]+$/i, "translation must be alphanumeric")
    .optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    ref: url.searchParams.get("ref") ?? undefined,
    tr: url.searchParams.get("tr") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const available = listAvailableTranslations();
  if (available.length === 0) {
    return NextResponse.json(
      { error: "no_provider_configured" },
      { status: 503 },
    );
  }

  // Resolve reference: explicit ?ref= or pick random from the global set.
  let reference = parsed.data.ref;
  let defaultTranslation: string | null = null;
  if (!reference) {
    const picked = await pickRandomReference();
    if (picked) {
      reference = picked.reference;
      defaultTranslation = picked.default_translation;
    } else {
      // Curated set is empty. Data layer falls back to its hardcoded
      // John 3:16 default below.
      reference = "John 3:16";
    }
  }

  // Resolve translation: explicit ?tr= must be available.
  // Else: scripture row's default_translation if available; else first
  // active translation.
  let translation = parsed.data.tr?.toUpperCase() ?? "";
  if (!translation || !available.some((t) => t.id === translation)) {
    translation =
      (defaultTranslation && available.some((t) => t.id === defaultTranslation)
        ? defaultTranslation
        : null) ?? available[0].id;
  }

  const verse = await getVerse({ reference, translation });

  return NextResponse.json({
    reference: verse.reference,
    text: verse.text,
    translation: verse.translation,
    copyright: verse.copyright,
    available_translations: available.map((t) => ({
      id: t.id,
      name: t.name,
    })),
  });
}
