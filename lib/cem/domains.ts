// Custom domain management (F20).
//
// Two halves:
//   1. DB layer — list / add / remove / verify rows in
//      core_tenant_domains. Tenant-scoped queries throughout.
//   2. Vercel REST integration — add the domain to the Vercel project
//      so Vercel can issue an SSL cert + route requests, and check DNS.
//
// SECURITY:
// - Every read/write is tenant-scoped. Even though domains are globally
//   unique by (text) value, our queries always include tenant_id.
// - The Vercel API token is read from env at request time. It is never
//   logged, never returned to the client, never embedded in the
//   response body of an action.
// - Verification rate-limit handled by the route handler — the data
//   layer is just a primitive set of operations.

import "server-only";

import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coreTenantDomains } from "@/db/schema";

export type DomainStatus = "pending" | "dns_verified" | "active" | "failed";

export type DomainRow = {
  id: string;
  domain: string;
  verification_status: DomainStatus;
  verification_token: string | null;
  verified: boolean;
  ssl_provisioned: boolean;
  is_primary: boolean;
  created_at: Date | null;
  verified_at: Date | null;
};

const VERCEL_API = "https://api.vercel.com";

// ── DB layer ─────────────────────────────────────────────────────────

export async function listDomains(tenantId: string): Promise<DomainRow[]> {
  const rows = await db
    .select()
    .from(coreTenantDomains)
    .where(eq(coreTenantDomains.tenant_id, tenantId));
  return rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    verification_status: (r.verification_status ?? "pending") as DomainStatus,
    verification_token: r.verification_token,
    verified: r.verified ?? false,
    ssl_provisioned: r.ssl_provisioned ?? false,
    is_primary: r.is_primary ?? false,
    created_at: r.created_at,
    verified_at: r.verified_at,
  }));
}

export async function addDomain(
  tenantId: string,
  addedBy: string,
  rawDomain: string,
): Promise<DomainRow> {
  const domain = normalizeDomain(rawDomain);
  if (!isValidDomainShape(domain)) {
    throw new Error("invalid_domain");
  }
  const token = randomBytes(16).toString("hex");

  const inserted = await db
    .insert(coreTenantDomains)
    .values({
      tenant_id: tenantId,
      domain,
      verification_status: "pending",
      verification_token: token,
      added_by: addedBy,
    })
    .returning();

  // Best-effort: register the domain with Vercel so it can issue SSL
  // once DNS verifies. If this fails (e.g. token missing) we still
  // keep the DB row — the user can retry verification later.
  try {
    await vercelAddDomain(domain);
  } catch (e) {
    console.warn("[domains] vercelAddDomain failed", { domain, error: String(e) });
  }

  const row = inserted[0];
  return {
    id: row.id,
    domain: row.domain,
    verification_status: (row.verification_status ?? "pending") as DomainStatus,
    verification_token: row.verification_token,
    verified: row.verified ?? false,
    ssl_provisioned: row.ssl_provisioned ?? false,
    is_primary: row.is_primary ?? false,
    created_at: row.created_at,
    verified_at: row.verified_at,
  };
}

export async function removeDomain(
  tenantId: string,
  domainId: string,
): Promise<void> {
  const rows = await db
    .select({ id: coreTenantDomains.id, domain: coreTenantDomains.domain })
    .from(coreTenantDomains)
    .where(
      and(
        eq(coreTenantDomains.id, domainId),
        eq(coreTenantDomains.tenant_id, tenantId),
      ),
    )
    .limit(1);
  if (rows.length === 0) throw new Error("not_found");

  await db
    .delete(coreTenantDomains)
    .where(
      and(
        eq(coreTenantDomains.id, domainId),
        eq(coreTenantDomains.tenant_id, tenantId),
      ),
    );

  try {
    await vercelRemoveDomain(rows[0].domain);
  } catch (e) {
    console.warn("[domains] vercelRemoveDomain failed", {
      domain: rows[0].domain,
      error: String(e),
    });
  }
}

export async function setPrimary(
  tenantId: string,
  domainId: string,
): Promise<void> {
  // Reset all in tenant to false…
  await db
    .update(coreTenantDomains)
    .set({ is_primary: false })
    .where(eq(coreTenantDomains.tenant_id, tenantId));
  // …then set the target.
  await db
    .update(coreTenantDomains)
    .set({ is_primary: true })
    .where(
      and(
        eq(coreTenantDomains.id, domainId),
        eq(coreTenantDomains.tenant_id, tenantId),
      ),
    );
}

/**
 * Verify a domain by:
 *   (a) confirming a CNAME or A record points at our app, AND
 *   (b) confirming a TXT record contains our verification token.
 * Both must match for verification to succeed. Updates the row on
 * success and returns the new status.
 */
export async function verifyDomain(
  tenantId: string,
  domainId: string,
): Promise<DomainRow> {
  const rows = await db
    .select()
    .from(coreTenantDomains)
    .where(
      and(
        eq(coreTenantDomains.id, domainId),
        eq(coreTenantDomains.tenant_id, tenantId),
      ),
    )
    .limit(1);
  if (rows.length === 0) throw new Error("not_found");
  const row = rows[0];
  if (!row.verification_token) throw new Error("no_verification_token");

  const cnameOk = await checkCnameOrA(row.domain);
  const txtOk = await checkTxt(row.domain, row.verification_token);

  if (cnameOk && txtOk) {
    // Mark verified. Vercel handles SSL provisioning automatically
    // once DNS is correct.
    const now = new Date();
    const updated = await db
      .update(coreTenantDomains)
      .set({
        verification_status: "active",
        verified: true,
        verified_at: now,
      })
      .where(eq(coreTenantDomains.id, domainId))
      .returning();
    const r = updated[0];
    return rowToDomain(r);
  }

  if (cnameOk || txtOk) {
    const updated = await db
      .update(coreTenantDomains)
      .set({ verification_status: "dns_verified" })
      .where(eq(coreTenantDomains.id, domainId))
      .returning();
    return rowToDomain(updated[0]);
  }

  // Both failed — keep status as pending; surface no change.
  return rowToDomain(row);
}

function rowToDomain(r: typeof coreTenantDomains.$inferSelect): DomainRow {
  return {
    id: r.id,
    domain: r.domain,
    verification_status: (r.verification_status ?? "pending") as DomainStatus,
    verification_token: r.verification_token,
    verified: r.verified ?? false,
    ssl_provisioned: r.ssl_provisioned ?? false,
    is_primary: r.is_primary ?? false,
    created_at: r.created_at,
    verified_at: r.verified_at,
  };
}

// ── Vercel REST integration ─────────────────────────────────────────

async function vercelAddDomain(domain: string): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    // Not configured (dev mode). No-op.
    return;
  }
  const teamParam = process.env.VERCEL_TEAM_ID
    ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
    : "";
  const res = await fetch(
    `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/domains${teamParam}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );
  if (!res.ok && res.status !== 409 /* already exists */) {
    throw new Error(`vercel_add_failed:${res.status}`);
  }
}

async function vercelRemoveDomain(domain: string): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return;
  const teamParam = process.env.VERCEL_TEAM_ID
    ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}`
    : "";
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamParam}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`vercel_remove_failed:${res.status}`);
  }
}

// ── DNS checks ──────────────────────────────────────────────────────

async function checkCnameOrA(domain: string): Promise<boolean> {
  const expected = process.env.APP_VERCEL_HOSTNAME ?? "cname.vercel-dns.com";
  try {
    const cnames = await dns.resolveCname(domain);
    if (cnames.some((c) => c.toLowerCase() === expected.toLowerCase())) {
      return true;
    }
  } catch {
    // No CNAME — fall through to A-record check.
  }
  // Some users will use A records pointing at Vercel's anycast IP. We
  // accept any A response as a permissive fallback when CNAME is
  // missing; the TXT check still has to match.
  try {
    const a = await dns.resolve4(domain);
    return a.length > 0;
  } catch {
    return false;
  }
}

async function checkTxt(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_cem-verify.${domain}`);
    const flat = records.map((parts) => parts.join("")).map((s) => s.trim());
    return flat.includes(token);
  } catch {
    return false;
  }
}

// ── Validation helpers ─────────────────────────────────────────────

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function isValidDomainShape(d: string): boolean {
  // Conservative regex: allow standard hostname characters + dots.
  // Disallow leading/trailing dot, consecutive dots, and >253 chars.
  if (d.length === 0 || d.length > 253) return false;
  if (d.startsWith(".") || d.endsWith(".")) return false;
  if (d.includes("..")) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}
