// Tenant resolution middleware.
//
// Per PRD Section 3 ("Middleware: Tenant Resolution"). Runs on every
// non-static request. Resolves the tenant from the request hostname
// (custom domain first, then subdomain) and injects three headers for
// downstream layouts and route handlers:
//
//   x-tenant-id     — UUID of the tenant
//   x-tenant-slug   — short slug (e.g. "newsong")
//   x-domain-type   — "subdomain" | "custom"
//
// SECURITY:
//
// - Runs in the Node.js runtime so we can use Drizzle + postgres-js for
//   tenant lookups. Edge runtime can't open TCP sockets to Postgres.
// - **Header sanitisation:** the middleware unconditionally strips any
//   incoming `x-tenant-*` and `x-domain-*` request headers before
//   processing, so a crafted client request can never spoof tenant
//   identity to downstream handlers (Section 16, rule 3 — tenant
//   isolation defense in depth).
// - **No open redirects:** the only destinations are the platform domain
//   (constant) or a primary custom domain looked up from the DB. User
//   input never controls the redirect target.
// - **Allowlisted reserved subdomains** (`api`, `custom`) bypass tenant
//   resolution and pass through untouched. A request to e.g.
//   `api.churchplatform.com` is platform-level, not tenant-scoped.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { lookupCustomDomain, lookupPrimaryDomain, lookupTenantBySlug } from "@/lib/tenant";

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "churchplatform.com";

// Hosts that should pass through untouched (no tenant resolution).
const PLATFORM_HOSTS = new Set<string>([
  PLATFORM_DOMAIN,
  `www.${PLATFORM_DOMAIN}`,
]);

// Subdomains under PLATFORM_DOMAIN that are reserved for platform use
// and must not be resolved as tenant slugs.
const RESERVED_SUBDOMAINS = new Set<string>(["custom", "api", "www"]);

// True when the request is local development. We accept any port and any
// localhost-ish host so devs can use `lvh.me` (a public DNS that resolves
// every name to 127.0.0.1) for subdomain testing.
function isLocalDev(hostname: string): boolean {
  const bareHost = hostname.split(":")[0];
  return (
    bareHost === "localhost" ||
    bareHost === "127.0.0.1" ||
    bareHost === "::1" ||
    bareHost.endsWith(".localhost") ||
    bareHost.endsWith(".lvh.me") ||
    bareHost === "lvh.me"
  );
}

function stripTenantHeaders(req: NextRequest): Headers {
  // Defense in depth: never let a client spoof the headers we inject.
  const cleaned = new Headers(req.headers);
  cleaned.delete("x-tenant-id");
  cleaned.delete("x-tenant-slug");
  cleaned.delete("x-domain-type");
  return cleaned;
}

function makeNext(req: NextRequest, opts?: { tenantId: string; tenantSlug: string; domainType: "subdomain" | "custom" }) {
  const requestHeaders = stripTenantHeaders(req);
  if (opts) {
    requestHeaders.set("x-tenant-id", opts.tenantId);
    requestHeaders.set("x-tenant-slug", opts.tenantSlug);
    requestHeaders.set("x-domain-type", opts.domainType);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function platformRedirect(): NextResponse {
  // Constant target — never user input. Open-redirect safe.
  return NextResponse.redirect(`https://${PLATFORM_DOMAIN}`);
}

export async function middleware(request: NextRequest) {
  // `host` already excludes credentials/scheme. May contain a port.
  const hostname = (request.headers.get("host") ?? "").toLowerCase();

  // ── Skip platform-level routes (incl. local dev) ──────────────────
  if (PLATFORM_HOSTS.has(hostname) || isLocalDev(hostname)) {
    return makeNext(request);
  }

  // ── 1. Custom domain check ────────────────────────────────────────
  // A request whose host doesn't end with `.${PLATFORM_DOMAIN}` is
  // either a custom tenant domain (e.g. newsongberlin.org) or unknown.
  if (!hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const tenantDomain = await lookupCustomDomain(hostname);
    if (tenantDomain?.verified && tenantDomain?.ssl_provisioned) {
      return makeNext(request, {
        tenantId: tenantDomain.tenant_id,
        tenantSlug: tenantDomain.tenant_slug,
        domainType: "custom",
      });
    }
    // Domain not recognised, not verified, or SSL not provisioned.
    return platformRedirect();
  }

  // ── 2. Subdomain check ────────────────────────────────────────────
  const subdomain = hostname.replace(`.${PLATFORM_DOMAIN}`, "").split(":")[0];

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return makeNext(request);
  }

  const tenant = await lookupTenantBySlug(subdomain);
  if (!tenant) return platformRedirect();

  // ── 3. Optional redirect to primary custom domain ─────────────────
  // If the tenant has chosen a primary custom domain and the user is
  // arriving via the default subdomain, redirect them. This keeps the
  // canonical URL clean.
  const primary = await lookupPrimaryDomain(tenant.id);
  if (primary && hostname !== primary.domain) {
    const url = new URL(request.url);
    url.hostname = primary.domain;
    url.port = "";
    // 308 (Permanent Redirect) preserves the HTTP method and is the
    // correct status for a canonical-host policy.
    return NextResponse.redirect(url.toString(), 308);
  }

  return makeNext(request, {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    domainType: "subdomain",
  });
}

export const config = {
  // Run on everything except Next.js static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  // Use Node.js runtime so we can talk to Postgres directly.
  // Requires `experimental.nodeMiddleware: true` in next.config.ts.
  runtime: "nodejs",
};
