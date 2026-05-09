"use client";

// Admin Unmapped Birthday Pool (F12). Collapsible amber banner that
// expands into a fluid card grid. Each card has a Map (with suggested
// match if any) and Dismiss action.
//
// SECURITY: All writes go through the admin-only server actions
// (lib/cem/unmapped-birthday-actions.ts) which verify role + tenant
// before touching the DB. UI gating here is cosmetic — even a
// crafted POST without admin role gets rejected at the action.

import { ChevronDown, User, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dismissBirthdayAction,
  mapBirthdayAction,
} from "@/lib/cem/unmapped-birthday-actions";
import type { UnmappedBirthdayItem } from "@/lib/cem/unmapped-birthdays";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function UnmappedPool({
  records,
}: {
  records: UnmappedBirthdayItem[];
}) {
  if (records.length === 0) return null;
  return (
    <details className="group mb-6">
      <summary
        className="flex cursor-pointer list-none items-center rounded-lg border px-5 py-2.5 transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
      >
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "#d97706" }}
        >
          {records.length} UNMAPPED
        </span>
        <span
          aria-hidden="true"
          className="mx-2 text-[11px] font-medium tracking-[0.08em]"
          style={{ color: "#d97706" }}
        >
          |
        </span>
        <span className="text-[11px]" style={{ color: "#92400e" }}>
          Review and map to user accounts
        </span>
        <ChevronDown
          className="ml-auto h-4 w-4 transition-transform duration-200 group-open:rotate-180"
          style={{ color: "#d97706" }}
          aria-hidden="true"
        />
      </summary>

      <ul className="mt-3 flex flex-wrap gap-3">
        {records.map((r) => (
          <li
            key={r.id}
            className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg"
            style={{ flex: "1 1 280px", maxWidth: 360, minWidth: 260 }}
          >
            <UnmappedCard record={r} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function UnmappedCard({ record }: { record: UnmappedBirthdayItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function map() {
    if (!record.suggest_match_user_id) return;
    setBusy(true);
    setError(null);
    try {
      const result = await mapBirthdayAction({
        unmappedId: record.id,
        userId: record.suggest_match_user_id,
      });
      if (!result.ok) {
        setError(result.error === "forbidden" ? "Admin only." : "Couldn't map.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      const result = await dismissBirthdayAction({ unmappedId: record.id });
      if (!result.ok) {
        setError(result.error === "forbidden" ? "Admin only." : "Couldn't dismiss.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const dateLabel = `${MONTHS[record.month - 1]} ${record.day}`;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cal-bg-muted"
          aria-hidden="true"
        >
          <User className="h-4 w-4 text-cal-text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-cal-text">{record.name}</div>
          <div className="mt-0.5 text-[11px] text-cal-text-muted">{dateLabel}</div>
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-2 border-t border-cal-border px-4 py-2.5"
        style={{ backgroundColor: "var(--cal-bg-subtle)" }}
      >
        {record.suggest_match_user_id && record.suggest_match_name ? (
          <span className="inline-flex items-center gap-1 truncate text-[11px] text-cal-accent">
            <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{record.suggest_match_name}</span>
          </span>
        ) : (
          <span className="truncate text-[11px] text-cal-text-muted">No match found</span>
        )}
        <div className="flex shrink-0 gap-1.5">
          {record.suggest_match_user_id ? (
            <button
              type="button"
              onClick={map}
              disabled={busy || pending}
              className="inline-flex h-7 items-center rounded-md bg-cal-brand px-2.5 text-[11px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-1"
            >
              Map
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            disabled={busy || pending}
            className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-1"
          >
            Dismiss
          </button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="border-t border-cal-border px-4 py-1.5 text-[11px] text-[color:var(--cal-status-deleted-text)]"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
