"use client";

// Lead Dashboard client wrapper. Server component fetches data;
// this component manages the "+ New Request" / "Edit Draft" modal
// state.

import { Edit, Eye, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatsRow } from "@/components/cem/stats-row";
import { StatusBadge } from "@/components/cem/status-badge";
import {
  CreateRequestModal,
  type CreateRequestModalRef,
} from "@/components/cem/create-request-modal";
import { useToast } from "@/components/cem/toast";
import { recallRequestAction } from "@/lib/cem/request-actions";
import type { RequestListItem } from "@/lib/cem/types";
import type { FeedbackEntry } from "@/lib/cem/feedback";

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
  feedbackByRequest,
}: {
  stats: { total: number; drafts: number; pending: number; approved: number };
  requests: RequestListItem[];
  departments: Array<{ id: string; name: string }>;
  /** EC-09: keyed by request id, only populated for returned requests. */
  feedbackByRequest: Record<string, FeedbackEntry[]>;
}) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const modalRef = useRef<CreateRequestModalRef>(null);

  async function handleRecall(id: string, title: string) {
    if (
      !window.confirm(
        `Recall "${title}"? It will go back to your drafts so you can edit and resubmit.`,
      )
    ) {
      return;
    }
    setBusyId(id);
    const r = await recallRequestAction(id);
    setBusyId(null);
    if (!r.ok) {
      toast.show(
        "error",
        r.error === "invalid_state"
          ? "An admin already started reviewing this. You can't recall it now."
          : "Couldn't recall. Try again.",
      );
      return;
    }
    toast.show("success", "Recalled to your drafts.");
    startTransition(() => router.refresh());
  }

  const filtered = search.trim()
    ? requests.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
    : requests;

  // EC-12: client-side pagination, 20 rows per page.
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  // Reset to page 1 whenever the search changes so we don't end up on
  // an empty page after a narrow filter.
  useEffect(() => {
    setPage(1);
  }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
                <RequestRowFragment
                  key={r.id}
                  r={r}
                  feedback={feedbackByRequest[r.id] ?? []}
                  busyId={busyId}
                  onRecall={handleRecall}
                  onEdit={(req) => modalRef.current?.openEdit(req)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* EC-12: pagination controls. */}
      {filtered.length > PAGE_SIZE ? (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-cal-text-muted">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[12px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-1 text-cal-text-secondary">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[12px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <CreateRequestModal ref={modalRef} departments={departments} />
    </div>
  );
}

function RequestRowFragment({
  r,
  feedback,
  busyId,
  onRecall,
  onEdit,
}: {
  r: RequestListItem;
  feedback: FeedbackEntry[];
  busyId: string | null;
  onRecall: (id: string, title: string) => void;
  onEdit: (req: {
    id: string;
    title: string;
    type: RequestListItem["type"];
    department_id: string | null;
    date: string | null;
    time: string | null;
    location: string | null;
    description: string | null;
    expected_attendance: number | null;
    budget: number | null;
  }) => void;
}) {
  const showFeedback = r.status === "returned" && feedback.length > 0;
  return (
    <>
      <tr
        className={`border-b border-cal-border ${
          showFeedback ? "" : "last:border-b-0"
        } hover:bg-cal-bg-subtle`}
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
                  onEdit({
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
            {/* EC-08: recall — only when not yet claimed. */}
            {r.status === "submitted" ? (
              <button
                type="button"
                title="Recall to drafts"
                aria-label="Recall request to drafts"
                onClick={() => onRecall(r.id, r.title)}
                disabled={busyId === r.id}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {/* EC-09: feedback thread for returned requests. */}
      {showFeedback ? (
        <tr className="border-b border-cal-border last:border-b-0 bg-[color:var(--cal-status-returned-bg,#fef2f2)]">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-cal-text-secondary">
              Feedback ({feedback.length})
            </div>
            <ol className="mt-2 space-y-2">
              {feedback.map((fb) => (
                <li
                  key={fb.id}
                  className="rounded-md border border-cal-border bg-cal-card-bg px-3 py-2 text-[12px]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-cal-text">
                      {fb.author_name ?? "Admin"}
                    </span>
                    <span className="text-[10px] text-cal-text-muted">
                      {fb.created_at
                        ? fb.created_at.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-cal-text-secondary">
                    {fb.content}
                  </p>
                </li>
              ))}
            </ol>
          </td>
        </tr>
      ) : null}
    </>
  );
}
