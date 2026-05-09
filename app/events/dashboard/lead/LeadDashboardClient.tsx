"use client";

// Lead Dashboard client wrapper. Server component fetches data;
// this component manages the "+ New Request" / "Edit Draft" modal
// state.

import { Edit, Eye, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { StatsRow } from "@/components/cem/stats-row";
import { StatusBadge } from "@/components/cem/status-badge";
import {
  CreateRequestModal,
  type CreateRequestModalRef,
} from "@/components/cem/create-request-modal";
import type { RequestListItem } from "@/lib/cem/types";

const SHORT_ID_LEN = 8;
function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, SHORT_ID_LEN).toUpperCase();
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LeadDashboardClient({
  stats,
  requests,
  departments,
}: {
  stats: { total: number; drafts: number; pending: number; approved: number };
  requests: RequestListItem[];
  departments: Array<{ id: string; name: string }>;
}) {
  const [search, setSearch] = useState("");
  const modalRef = useRef<CreateRequestModalRef>(null);

  const visible = search.trim()
    ? requests.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
    : requests;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            Lead Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-cal-text-secondary">
            Track your event requests and create new ones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => modalRef.current?.openNew()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Request
        </button>
      </header>

      <div className="mb-8">
        <StatsRow
          ariaLabel="Lead request statistics"
          stats={[
            { number: stats.total, label: "All requests" },
            { number: stats.drafts, label: "Drafts" },
            { number: stats.pending, label: "Pending" },
            { number: stats.approved, label: "Approved" },
          ]}
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
          All Requests
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          maxLength={200}
          className="w-[200px] rounded-lg border border-cal-border bg-cal-bg px-3 py-1.5 text-[12px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-cal-text-muted">
            {requests.length === 0
              ? "You have not created any event requests yet."
              : `No requests matching "${search}"`}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-cal-border bg-cal-bg-subtle text-left text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                <th className="w-[88px] px-6 py-2.5">ID</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="w-[150px] px-3 py-2.5">Department</th>
                <th className="w-[140px] px-3 py-2.5">Status</th>
                <th className="w-[110px] px-3 py-2.5">Submitted</th>
                <th className="w-[80px] px-6 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-cal-border last:border-b-0 hover:bg-cal-bg-subtle"
                >
                  <td className="px-6 py-2.5 font-mono text-[11px] text-cal-text-muted">
                    {shortId(r.id)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-cal-text">{r.title}</td>
                  <td className="px-3 py-2.5 text-[12px] text-cal-text-secondary">
                    {r.department_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-cal-text-muted">
                    {formatDate(r.submitted_at)}
                  </td>
                  <td className="px-6 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="View details"
                        aria-label="View details"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {r.status === "draft" || r.status === "returned" ? (
                        <button
                          type="button"
                          title="Edit draft"
                          aria-label="Edit draft"
                          onClick={() =>
                            modalRef.current?.openEdit({
                              id: r.id,
                              title: r.title,
                              type: r.type,
                              department_id: r.department_id,
                              date: r.date,
                              time: r.time,
                              location: r.location,
                              description: r.description,
                              expected_attendance: r.expected_attendance,
                              budget: r.budget,
                            })
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
                        >
                          <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateRequestModal ref={modalRef} departments={departments} />
    </div>
  );
}
