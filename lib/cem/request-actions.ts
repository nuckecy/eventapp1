"use server";

// Server actions for request lifecycle (F14-F16).
//
// Each action verifies the caller's role server-side before doing
// anything. Tenant + userId come from the session, never from input.
// Inputs validated with Zod.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  approveAndPublishRequest,
  claimRequest,
  createRequestDraft,
  deleteRequest,
  forwardRequest,
  returnRequest,
  sendBackRequestToAdmin,
  submitRequest,
  updateRequestDraft,
  type CreateRequestInput,
} from "@/lib/cem/requests";

function isLead(role: string | undefined) {
  return role === "lead" || role === "admin" || role === "superadmin" || role === "platform_admin";
}
function isAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin" || role === "platform_admin";
}
function isSuper(role: string | undefined) {
  return role === "superadmin" || role === "platform_admin";
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const RequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(["sunday", "regional", "local"]),
  department_id: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  time: z.string().max(50).nullable(),
  location: z.string().max(200).nullable(),
  description: z.string().max(2000).nullable(),
  expected_attendance: z.number().int().min(0).max(1_000_000).nullable(),
  budget: z.number().int().min(0).max(1_000_000_000).nullable(),
}) satisfies z.ZodType<CreateRequestInput>;

const UuidSchema = z.string().uuid();

const ReturnSchema = z.object({
  requestId: z.string().uuid(),
  feedback: z.string().trim().min(10).max(2000),
});

export async function createRequestAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isLead(session.role)) return { ok: false, error: "forbidden" };
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    const id = await createRequestDraft(session.tenantId, session.userId, parsed.data);
    revalidatePath("/events/dashboard/lead");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "create_failed" };
  }
}

export async function updateDraftAction(
  requestId: unknown,
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isLead(session.role)) return { ok: false, error: "forbidden" };
  const idParsed = UuidSchema.safeParse(requestId);
  const inputParsed = RequestSchema.safeParse(input);
  if (!idParsed.success || !inputParsed.success) {
    return { ok: false, error: "invalid_payload" };
  }
  try {
    await updateRequestDraft(
      session.tenantId,
      session.userId,
      idParsed.data,
      inputParsed.data,
    );
    revalidatePath("/events/dashboard/lead");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update_failed" };
  }
}

export async function submitRequestAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isLead(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    await submitRequest(session.tenantId, session.userId, id.data);
    revalidatePath("/events/dashboard/lead");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "submit_failed" };
  }
}

export async function claimRequestAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdmin(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    await claimRequest(session.tenantId, session.userId, id.data);
    revalidatePath("/events/dashboard/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "claim_failed" };
  }
}

export async function forwardRequestAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdmin(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    await forwardRequest(session.tenantId, session.userId, id.data);
    revalidatePath("/events/dashboard/admin");
    revalidatePath("/events/dashboard/super");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "forward_failed" };
  }
}

export async function returnRequestAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdmin(session.role)) return { ok: false, error: "forbidden" };
  const parsed = ReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    await returnRequest(
      session.tenantId,
      session.userId,
      parsed.data.requestId,
      parsed.data.feedback,
    );
    revalidatePath("/events/dashboard/admin");
    revalidatePath("/events/dashboard/lead");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "return_failed" };
  }
}

export async function approveRequestAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    const { eventId } = await approveAndPublishRequest(
      session.tenantId,
      session.userId,
      id.data,
    );
    revalidatePath("/events/dashboard/super");
    revalidatePath("/events");
    return { ok: true, id: eventId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "approve_failed" };
  }
}

export async function sendBackToAdminAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    await sendBackRequestToAdmin(session.tenantId, session.userId, id.data);
    revalidatePath("/events/dashboard/super");
    revalidatePath("/events/dashboard/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_back_failed" };
  }
}

export async function deleteRequestAction(requestId: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isSuper(session.role)) return { ok: false, error: "forbidden" };
  const id = UuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, error: "invalid_payload" };
  try {
    await deleteRequest(session.tenantId, session.userId, id.data);
    revalidatePath("/events/dashboard/super");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "delete_failed" };
  }
}
