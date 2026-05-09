"use server";

// Server actions for the notification dropdown (F17).
// Read endpoints are session-scoped; write endpoints validate the
// notification belongs to the authenticated user before mutating.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  countUnread,
  listOwnNotifications,
  markRead,
  toggleMute,
} from "./notifications";

const UuidSchema = z.string().uuid();

export type NotificationDTO = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  reference_type: string | null;
  reference_id: string | null;
  read: boolean;
  muted: boolean;
  created_at: Date;
};

export async function fetchOwnNotificationsAction(): Promise<{
  ok: true;
  items: NotificationDTO[];
  unread: number;
}> {
  const session = await getSession();
  if (!session) return { ok: true, items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    listOwnNotifications(session.tenantId, session.userId, 25),
    countUnread(session.tenantId, session.userId),
  ]);
  // SECURITY: cast to DTO with the same shape — RLS + the WHERE clause
  // already guarantee only this user's rows. We still narrow the type
  // explicitly so future schema additions don't accidentally leak.
  return {
    ok: true,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type ?? "request.submitted",
      reference_type: n.reference_type,
      reference_id: n.reference_id,
      read: n.read ?? false,
      muted: n.muted ?? false,
      created_at: n.created_at ?? new Date(),
    })),
    unread,
  };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markNotificationReadAction(
  id: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const parsed = UuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  await markRead(session.tenantId, session.userId, parsed.data);
  revalidatePath("/events", "layout");
  return { ok: true };
}

export async function toggleNotificationMuteAction(
  id: unknown,
  muted: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const parsedId = UuidSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid_payload" };
  if (typeof muted !== "boolean") return { ok: false, error: "invalid_payload" };
  await toggleMute(session.tenantId, session.userId, parsedId.data, muted);
  revalidatePath("/events", "layout");
  return { ok: true };
}
