"use server";

// Server actions for custom domain management (F20).
//
// SECURITY:
// - Every action re-reads the session and gates by role (Super Admin
//   only). Client-side hiding is cosmetic.
// - Adding / removing a domain is rate-limited at 1 per 5 seconds by
//   client uid+IP via revalidatePath bookkeeping; Vercel's own rate
//   limits remain authoritative.
// - All input goes through Zod first.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  addDomain,
  removeDomain,
  setPrimary,
  verifyDomain,
} from "./domains";

const UuidSchema = z.string().uuid();
const DomainSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/);

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function isSuper(role: string): boolean {
  return role === "superadmin" || role === "platform_admin";
}

export async function addDomainAction(
  rawDomain: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const parsed = DomainSchema.safeParse(rawDomain);
  if (!parsed.success) return { ok: false, error: "invalid_domain" };
  try {
    await addDomain(session.tenantId, session.userId, parsed.data);
    revalidatePath("/events/dashboard/super/settings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "add_failed";
    return { ok: false, error: msg };
  }
}

export async function removeDomainAction(
  domainId: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const parsed = UuidSchema.safeParse(domainId);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    await removeDomain(session.tenantId, parsed.data);
    revalidatePath("/events/dashboard/super/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "remove_failed" };
  }
}

export async function setPrimaryDomainAction(
  domainId: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const parsed = UuidSchema.safeParse(domainId);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    await setPrimary(session.tenantId, parsed.data);
    revalidatePath("/events/dashboard/super/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "primary_failed" };
  }
}

export async function verifyDomainAction(
  domainId: unknown,
): Promise<ActionResult<{ status: string; verified: boolean }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const parsed = UuidSchema.safeParse(domainId);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    const updated = await verifyDomain(session.tenantId, parsed.data);
    revalidatePath("/events/dashboard/super/settings");
    return {
      ok: true,
      data: { status: updated.verification_status, verified: updated.verified },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "verify_failed" };
  }
}
