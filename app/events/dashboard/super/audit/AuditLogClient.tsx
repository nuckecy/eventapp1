"use client";

// Audit log viewer client (F18). Pure presentation: filter chips +
// table rows. Server reloads on filter change via router.replace.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { AuditFilters } from "@/lib/cem/audit";

type Row = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: string | null;
  created_at: Date;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
};

const ACTION_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All actions" },
  { value: "request", label: "Requests" },
  { value: "birthday", label: "Birthdays" },
  { value: "event", label: "Events" },
];

const TARGET_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All targets" },
  { value: "request", label: "Request" },
  { value: "event", label: "Event" },
  { value: "birthday", label: "Birthday" },
];

export function AuditLogClient({
  rows,
  filters,
}: {
  rows: Row[];
  filters: AuditFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(name: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(name, value);
    else sp.delete(name);
    startTransition(() => {
      router.replace(`?${sp.toString()}`);
    });
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-medium leading-tight">
          Audit Log
        </h1>
        <p className="mt-1 text-[13px] text-cal-text-secondary">
          Immutable record of every state change. Read-only.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by action"
          value={filters.actionPrefix ?? ""}
          onChange={(e) => setParam("action", e.target.value)}
          className="h-8 rounded-lg border border-cal-border bg-cal-bg px-2 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by target type"
          value={filters.targetType ?? ""}
          onChange={(e) => setParam("target", e.target.value)}
          className="h-8 rounded-lg border border-cal-border bg-cal-bg px-2 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
        >
          {TARGET_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-cal-text-secondary">
          From
          <input
            type="date"
            value={filters.fromDate ?? ""}
            onChange={(e) => setParam("from", e.target.value)}
            className="h-8 rounded-lg border border-cal-border bg-cal-bg px-2 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-cal-text-secondary">
          To
          <input
            type="date"
            value={filters.toDate ?? ""}
            onChange={(e) => setParam("to", e.target.value)}
            className="h-8 rounded-lg border border-cal-border bg-cal-bg px-2 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
          />
        </label>
        <span className="ml-auto text-[11px] text-cal-text-muted">
          {isPending ? "Updating…" : `${rows.length} entries`}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-cal-text-muted">
            No audit log entries match these filters.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-cal-border bg-cal-bg-subtle text-left text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                <th className="w-[150px] px-4 py-2.5">When</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="w-[180px] px-3 py-2.5">Action</th>
                <th className="w-[100px] px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-cal-border last:border-b-0 hover:bg-cal-bg-subtle"
                >
                  <td className="px-4 py-2 align-top text-cal-text-muted">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-cal-text">
                      {r.actor_name ?? "—"}
                    </div>
                    {r.actor_email ? (
                      <div className="text-[10px] text-cal-text-muted">
                        {r.actor_email}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className="rounded bg-cal-bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {r.action}
                    </code>
                  </td>
                  <td className="px-3 py-2 align-top text-cal-text-secondary">
                    {r.target_type}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.metadata ? (
                      <details>
                        <summary className="cursor-pointer text-[10px] text-cal-text-muted hover:text-cal-text">
                          metadata
                        </summary>
                        <pre className="mt-1 max-w-[400px] overflow-x-auto rounded bg-cal-bg-muted p-2 font-mono text-[10px]">
                          {prettyJson(r.metadata)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-cal-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
