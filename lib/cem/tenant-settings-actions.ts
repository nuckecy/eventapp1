"use server";

// Tenant-settings server actions. Super admin (the tenant's own
// admin) or platform admin can update.

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { setTenantSettings } from "./tenant-settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

function isAllowed(role: string | undefined): boolean {
  return role === "superadmin" || role === "platform_admin";
}

const ToggleScriptureInput = z.object({
  enabled: z.boolean(),
});

export async function setScriptureEnabledAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAllowed(session.role)) return { ok: false, error: "forbidden" };
  const parsed = ToggleScriptureInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  try {
    await setTenantSettings(session.tenantId, {
      scripture_enabled: parsed.data.enabled,
    });
    revalidateTag("tenant-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "save_failed" };
  }
}
