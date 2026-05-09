"use client";

import { Trash2, Star, RefreshCw, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/cem/toast";
import {
  addDomainAction,
  removeDomainAction,
  setPrimaryDomainAction,
  verifyDomainAction,
} from "@/lib/cem/domain-actions";
import type { DomainStatus } from "@/lib/cem/domains";

type DomainRow = {
  id: string;
  domain: string;
  verification_status: DomainStatus;
  verification_token: string | null;
  verified: boolean;
  ssl_provisioned: boolean;
  is_primary: boolean;
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  pending: "Pending DNS",
  dns_verified: "Partially verified",
  active: "Active",
  failed: "Failed",
};

const STATUS_COLORS: Record<DomainStatus, string> = {
  pending: "var(--cal-status-draft-text)",
  dns_verified: "var(--cal-status-pending-text)",
  active: "var(--cal-status-approved-text)",
  failed: "var(--cal-status-deleted-text)",
};

export function DomainsClient({
  domains,
  tenantSlug,
  cnameTarget,
}: {
  domains: DomainRow[];
  tenantSlug: string;
  cnameTarget: string;
}) {
  const [newDomain, setNewDomain] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newDomain.trim().length === 0) return;
    setAdding(true);
    const r = await addDomainAction(newDomain.trim());
    setAdding(false);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Domain added. Configure DNS to verify.");
    setNewDomain("");
    startTransition(() => router.refresh());
  }

  async function handleVerify(id: string) {
    setBusyId(id);
    const r = await verifyDomainAction(id);
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    if (r.data?.verified) {
      toast.show("success", "Domain verified.");
    } else if (r.data?.status === "dns_verified") {
      toast.show("error", "Partial: only one of CNAME or TXT matches.");
    } else {
      toast.show("error", "DNS records not detected yet.");
    }
    startTransition(() => router.refresh());
  }

  async function handleRemove(id: string, domain: string) {
    if (!window.confirm(`Remove ${domain}?\n\nThis cannot be undone.`)) return;
    setBusyId(id);
    const r = await removeDomainAction(id);
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Domain removed.");
    startTransition(() => router.refresh());
  }

  async function handleSetPrimary(id: string) {
    setBusyId(id);
    const r = await setPrimaryDomainAction(id);
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Primary domain updated.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Tenant Settings
        </h1>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Manage custom domains for <strong>{tenantSlug}</strong>.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-cal-border bg-cal-card-bg p-6">
        <h2 className="font-display text-[18px] font-medium leading-tight">
          Add a custom domain
        </h2>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Use a domain you own — e.g. <code>events.yourchurch.org</code>.
        </p>
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="events.yourchurch.org"
            maxLength={253}
            className="flex-1 rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
          Configured Domains ({domains.length})
        </h2>

        {domains.length === 0 ? (
          <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-12 text-center text-[13px] text-cal-text-muted">
            No custom domains yet. Add one above to get started.
          </div>
        ) : (
          <ul className="space-y-3">
            {domains.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-cal-border bg-cal-card-bg p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px] font-medium text-cal-text">
                        {d.domain}
                      </span>
                      {d.is_primary ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-cal-border bg-cal-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cal-brand">
                          <Star className="h-2.5 w-2.5" aria-hidden="true" />
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px]">
                      <span
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          color: STATUS_COLORS[d.verification_status],
                          borderColor: STATUS_COLORS[d.verification_status],
                        }}
                      >
                        {STATUS_LABEL[d.verification_status]}
                      </span>
                      {d.ssl_provisioned ? (
                        <span className="text-[11px] text-cal-text-muted">SSL ready</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleVerify(d.id)}
                      disabled={busyId === d.id}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      Verify
                    </button>
                    {!d.is_primary && d.verified ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(d.id)}
                        disabled={busyId === d.id}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted disabled:opacity-50"
                      >
                        Set primary
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemove(d.id, d.domain)}
                      disabled={busyId === d.id}
                      title="Remove domain"
                      aria-label="Remove domain"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-[color:var(--cal-status-deleted-text)] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {!d.verified && d.verification_token ? (
                  <div className="mt-4 rounded-md border border-cal-border bg-cal-bg-subtle p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-cal-text-secondary">
                      DNS Configuration
                    </p>
                    <p className="mt-1 text-[12px] text-cal-text-secondary">
                      Add these records to <code>{d.domain}</code> at your DNS provider:
                    </p>
                    <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                      <div>
                        <span className="inline-block w-12 font-semibold text-cal-text-muted">
                          CNAME
                        </span>
                        <span className="text-cal-text">{d.domain}</span>
                        <span className="mx-2 text-cal-text-muted">→</span>
                        <span className="text-cal-text">{cnameTarget}</span>
                      </div>
                      <div>
                        <span className="inline-block w-12 font-semibold text-cal-text-muted">
                          TXT
                        </span>
                        <span className="text-cal-text">_cem-verify.{d.domain}</span>
                        <span className="mx-2 text-cal-text-muted">→</span>
                        <span className="text-cal-text">{d.verification_token}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired.";
    case "forbidden":
      return "Super admin only.";
    case "invalid_domain":
      return "Please enter a valid domain (e.g. events.yourchurch.org).";
    case "not_found":
      return "Domain not found.";
    default:
      return "Couldn't complete. Try again.";
  }
}
