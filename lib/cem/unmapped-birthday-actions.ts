"use server";

// Admin-only server actions for the Unmapped Birthday Pool (F12).
//
// SECURITY:
// - Each action verifies the caller is admin/superadmin before
//   touching the database (defence in depth on top of any UI gating).
// - userId/tenantId taken from the session, never from input.
// - Inputs validated with Zod.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  dismissUnmappedBirthday,
  mapUnmappedBirthday,
} from "@/lib/cem/unmapped-birthdays";

function isAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin" || role === "platform_admin";
}

const MapInput = z.object({
  unmappedId: z.string().uuid(),
  userId: z.string().uuid(),
});

const DismissInput = z.object({
  unmappedId: z.string().uuid(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function mapBirthdayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdmin(session.role)) return { ok: false, error: "forbidden" };

  const parsed = MapInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  try {
    await mapUnmappedBirthday(
      session.tenantId,
      parsed.data.unmappedId,
      parsed.data.userId,
      session.userId,
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : "error";
    return { ok: false, error: reason };
  }
  revalidatePath("/events/birthdays");
  return { ok: true };
}

export async function dismissBirthdayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdmin(session.role)) return { ok: false, error: "forbidden" };

  const parsed = DismissInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  try {
    await dismissUnmappedBirthday(
      session.tenantId,
      parsed.data.unmappedId,
      session.userId,
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : "error";
    return { ok: false, error: reason };
  }
  revalidatePath("/events/birthdays");
  return { ok: true };
}
