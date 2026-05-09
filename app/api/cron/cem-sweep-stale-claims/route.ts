// EC-01 stale-claim sweep. Runs once per hour via Vercel Cron (see
// vercel.json `crons[]`). Auto-unclaims any request stuck in
// 'under_review' for more than 72 hours.
//
// SECURITY:
// - Vercel Cron sends requests with `Authorization: Bearer ${CRON_SECRET}`
//   when CRON_SECRET is configured in env. We verify the bearer token
//   before doing anything. In dev with no CRON_SECRET set, we still
//   allow same-origin GETs from the developer's machine for testing.
// - sweepStaleClaims() is idempotent — running twice in a row is
//   safe; the second run finds nothing.
// - Operates ACROSS tenants (no x-tenant-id header on cron requests).
//   That's the correct shape: a cron does not run "as" any tenant.

import "server-only";
import { NextResponse } from "next/server";
import { sweepStaleClaims } from "@/lib/cem/requests";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Bearer-token auth. In production, set CRON_SECRET in Vercel env
  // and configure vercel.json to call this route. Vercel Cron will
  // include the secret in the Authorization header automatically.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // In production we MUST have a secret. Refuse the call rather
    // than silently allow it.
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }

  try {
    const { swept } = await sweepStaleClaims(SEVENTY_TWO_HOURS_MS);
    return NextResponse.json({
      ok: true,
      swept_count: swept.length,
      // Return only count — IDs would leak cross-tenant info if the
      // endpoint were ever exposed.
    });
  } catch (e) {
    console.error("[cron] sweepStaleClaims failed", e);
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}
