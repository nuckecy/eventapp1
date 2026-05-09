"use client";

// Admin Dashboard client (FR-6).
//
// 4-tab queue: New / Under Review / Forwarded / Returned. Per-row
// actions: Claim (New only), Forward (Under Review only), Return
// (Under Review only). State transitions enforced server-side.

import { Eye } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatsRow } from "@/components/cem/stats-row";
import { StatusBadge } from "@/components/cem/status-badge";
import { FeedbackModal, type FeedbackModalRef } from "@/components/cem/feedback-modal";
import { useToast } from "@/components/cem/toast";
import {
  claimRequestAction,
  forwardRequestAction,
  unclaimRequestAction,
} from "@/lib/cem/request-actions";
import type { RequestListItem, RequestStatus } from "@/lib/cem/types";

type TabKey = "new" | "review" | "forwarded" | "returned";

const TABS: Array<{ key: TabKey; label: string; statuses: RequestStatus[] }> = [
  { key: "new", label: "New Requests", statuses: ["submitted"] },
  { key: "review", label: "Under Review", statuses: ["under_review"] },
  { key: "forwarded", label: "Forwarded", statuses: ["ready_for_approval"] },
  { key: "returned", label: "Returned", statuses: ["returned"] },
];

export function AdminDashboardClient({
  stats,
  requests,
  currentUserId,
  currentRole,
}: {
  stats: {
    submitted: number;
    underReview: number;
    forwarded: number;
    returned: number;
    totalPending: number;
  };
  requests: RequestListItem[];
  currentUserId: string;
  currentRole: string;
}) {
  const [tab, setTab] = useState<TabKey>("new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const feedbackRef = useRef<FeedbackModalRef>(null);
  const toast = useToast();

  const counts: Record<TabKey, number> = {
    new: stats.submitted,
    review: stats.underReview,
    forwarded: stats.forwarded,
    returned: stats.returned,
  };

  const visible = requests.filter((r) =>
    TABS.find((t) => t.key === tab)?.statuses.includes(r.status),
  );

  async function handleClaim(id: string) {
    setBusyId(id);
    setError(null);
    const r = await claimRequestAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Claimed for review.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }
  async function handleForward(id: string) {
    setBusyId(id);
    setError(null);
    const r = await forwardRequestAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Forwarded for approval.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }
  async function handleUnclaim(id: string, isOwn: boolean) {
    const verb = isOwn ? "Unclaim" : "Reassign";
    if (!window.confirm(`${verb} this request? It will return to the new requests pool.`)) {
      return;
    }
    setBusyId(id);
    setError(null);
    const r = await unclaimRequestAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", isOwn ? "Released back to queue." : "Reassigned to queue.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  const isSuper = currentRole === "superadmin" || currentRole === "platform_admin";

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Triage incoming event requests.
        </p>
      </header>

      <div className="mb-8">
        <StatsRow
          ariaLabel="Admin queue statistics"
          stats={[
            { number: stats.totalPending, label: "Total pending" },
            { number: stats.submitted, label: "New" },
            { number: stats.underReview, label: "Under review" },
            { number: stats.forwarded, label: "Forwarded" },
            { number: stats.returned, label: "Returned" },
          ]}
        />
      </div>

      <div role="tablist" aria-label="Request queue" className="mb-3 flex flex-wrap gap-1 border-b border-cal-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent ${
                active
                  ? "border-cal-brand text-cal-text"
                  : "border-transparent text-cal-text-secondary hover:text-cal-text"
              }`}
            >
              {t.label}
              <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-cal-bg-subtle px-1 text-[10px] font-semibold text-cal-text-muted">
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[color:var(--cal-status-deleted-text)]"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-cal-text-muted">
            No requests in this category.
          </div>
        ) : (
          <ul>
            {visible.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 border-b border-cal-border px-6 py-3 last:border-b-0 hover:bg-cal-bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-cal-text">{r.title}</div>
                  <div className="mt-0.5 text-[12px] text-cal-text-muted">
                    {r.department_name ?? "—"} · submitted {formatDate(r.submitted_at)}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="View details"
                    aria-label="View details"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {r.status === "submitted" ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(r.id)}
                      disabled={busyId === r.id}
                      className="inline-flex h-7 items-center rounded-md bg-cal-brand px-2.5 text-[11px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Claiming…" : "Claim for review"}
                    </button>
                  ) : null}
                  {r.status === "under_review" ? (
                    <>
                      {r.claimed_by === currentUserId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleForward(r.id)}
                            disabled={busyId === r.id}
                            className="inline-flex h-7 items-center rounded-md bg-cal-brand px-2.5 text-[11px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Forward
                          </button>
                          <button
                            type="button"
                            onClick={() => feedbackRef.current?.open(r.id, r.title)}
                            disabled={busyId === r.id}
                            className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted"
                          >
                            Return
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnclaim(r.id, true)}
                            disabled={busyId === r.id}
                            title="Release back to queue"
                            className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                          >
                            Unclaim
                          </button>
                        </>
                      ) : isSuper ? (
                        <button
                          type="button"
                          onClick={() => handleUnclaim(r.id, false)}
                          disabled={busyId === r.id}
                          title="Force-reassign to queue"
                          className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                        >
                          Reassign
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FeedbackModal ref={feedbackRef} />
    </div>
  );
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired.";
    case "forbidden":
      return "Admin only.";
    case "already_claimed":
      return "Another admin already claimed this. Refresh to see the latest.";
    case "invalid_state":
      return "This request was updated by someone else. Refresh and try again.";
    case "not_claimer":
      return "Only the admin who claimed this can act on it.";
    default:
      return "Couldn't complete. Try again.";
  }
}
