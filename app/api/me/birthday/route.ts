// /api/me/birthday — F11.
//
// GET  → returns the authenticated user's own birthday WITH year.
//        This is the ONLY endpoint where year is permitted.
// PUT  → upserts the user's own birthday. Body schema:
//          { day: 1-31, month: 1-12, year: number|null, show_age: boolean }
//
// SECURITY:
// - userId taken from the authenticated session — NEVER from the
//   request body or URL params (key rule #3).
// - tenantId taken from middleware-injected headers via the existing
//   getSession() helper.
// - Body validated with Zod before reaching the data layer.
// - Year range-checked twice (Zod + data layer).
// - Same-origin enforced for PUT via the Origin header (defence in
//   depth on top of Next.js's CSRF for app-router routes).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getOwnBirthday, upsertOwnBirthday } from "@/lib/cem/own-birthday";

const CURRENT_YEAR = new Date().getFullYear();

const PutSchema = z.object({
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(CURRENT_YEAR).nullable(),
  show_age: z.boolean(),
});

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function badRequest(reason: string) {
  return NextResponse.json({ error: reason }, { status: 400 });
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const data = await getOwnBirthday(session.tenantId, session.userId);
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  // Same-origin guard.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "cross_origin" }, { status: 403 });
      }
    } catch {
      return badRequest("bad_origin");
    }
  }

  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid_json");
  }

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("invalid_payload");
  }

  // Day-of-month must be valid for the chosen month (e.g. Feb 30 invalid).
  // We use a placeholder year for the check (any non-leap year works for
  // most cases; if year is supplied we use it).
  const year = parsed.data.year ?? 2001; // 2001 = non-leap reference
  const probe = new Date(year, parsed.data.month - 1, parsed.data.day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== parsed.data.month - 1 ||
    probe.getDate() !== parsed.data.day
  ) {
    return badRequest("invalid_date");
  }

  await upsertOwnBirthday(session.tenantId, session.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
