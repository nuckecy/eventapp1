"use client";

// CreateRequestModal — Lead's New Request / Edit Draft form.
// Built on the native <dialog> element (same pattern as F07's
// EventDetailModal so we get focus trap, Esc, scroll-lock for free).

import { X } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  createRequestAction,
  submitRequestAction,
  updateDraftAction,
} from "@/lib/cem/request-actions";
import { useToast } from "@/components/cem/toast";

export type CreateRequestModalRef = {
  openNew: () => void;
  openEdit: (req: ExistingDraft) => void;
};

export type ExistingDraft = {
  id: string;
  title: string;
  type: "sunday" | "regional" | "local";
  department_id: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  description: string | null;
  expected_attendance: number | null;
  budget: number | null;
};

type FormState = {
  title: string;
  type: "sunday" | "regional" | "local";
  department_id: string;
  date: string;
  time: string;
  location: string;
  description: string;
  expected_attendance: string;
  budget: string;
};

const empty: FormState = {
  title: "",
  type: "local",
  department_id: "",
  date: "",
  time: "",
  location: "",
  description: "",
  expected_attendance: "",
  budget: "",
};

function fromDraft(d: ExistingDraft): FormState {
  return {
    title: d.title,
    type: d.type,
    department_id: d.department_id ?? "",
    date: d.date ?? "",
    time: d.time ?? "",
    location: d.location ?? "",
    description: d.description ?? "",
    expected_attendance: d.expected_attendance != null ? String(d.expected_attendance) : "",
    budget: d.budget != null ? String(d.budget) : "",
  };
}

export const CreateRequestModal = forwardRef<
  CreateRequestModalRef,
  { departments: Array<{ id: string; name: string }> }
>(function CreateRequestModal({ departments }, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useImperativeHandle(
    ref,
    () => ({
      openNew: () => {
        setEditingId(null);
        setState({ ...empty, department_id: departments[0]?.id ?? "" });
        setError(null);
        dialogRef.current?.showModal();
      },
      openEdit: (req) => {
        setEditingId(req.id);
        setState(fromDraft(req));
        setError(null);
        dialogRef.current?.showModal();
      },
    }),
    [departments],
  );

  function close() {
    dialogRef.current?.close();
  }

  function payload() {
    return {
      title: state.title.trim(),
      type: state.type,
      department_id: state.department_id,
      date: state.date || null,
      time: state.time.trim() || null,
      location: state.location.trim() || null,
      description: state.description.trim() || null,
      expected_attendance:
        state.expected_attendance.trim() !== "" ? Number(state.expected_attendance) : null,
      budget: state.budget.trim() !== "" ? Number(state.budget) : null,
    };
  }

  async function saveDraft() {
    setError(null);
    setBusy(true);
    try {
      const result = editingId
        ? await updateDraftAction(editingId, payload())
        : await createRequestAction(payload());
      if (!result.ok) {
        setError(humanError(result.error));
        toast.show("error", humanError(result.error));
        return;
      }
      toast.show("success", editingId ? "Draft updated." : "Draft saved.");
      close();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      // First save (or update) so the persisted state matches the
      // form, then submit.
      const saveResult = editingId
        ? await updateDraftAction(editingId, payload())
        : await createRequestAction(payload());
      if (!saveResult.ok) {
        setError(humanError(saveResult.error));
        toast.show("error", humanError(saveResult.error));
        return;
      }
      const id = "id" in saveResult && saveResult.id ? saveResult.id : editingId;
      if (!id) {
        setError("Couldn't submit. Try again.");
        toast.show("error", "Couldn't submit. Try again.");
        return;
      }
      const submitResult = await submitRequestAction(id);
      if (!submitResult.ok) {
        setError(humanError(submitResult.error));
        toast.show("error", humanError(submitResult.error));
        return;
      }
      toast.show("success", "Request submitted for review.");
      close();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const isEditing = editingId != null;

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setError(null)}
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      aria-labelledby="create-request-title"
      className="z-50 w-[calc(100vw-32px)] max-w-[600px] overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg p-0 text-cal-text shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between border-b border-cal-border px-6 py-4">
        <h2
          id="create-request-title"
          className="m-0 font-display text-[18px] font-medium tracking-[-0.01em]"
        >
          {isEditing ? "Edit Draft" : "New Event Request"}
        </h2>
        <form method="dialog">
          <button
            type="submit"
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        className="grid gap-4 px-6 py-5"
      >
        <Field label="Event Title">
          <input
            required
            minLength={3}
            maxLength={200}
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            className={inputClasses}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event Type">
            <select
              value={state.type}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  type: e.target.value as FormState["type"],
                }))
              }
              className={inputClasses}
            >
              <option value="local">Local</option>
              <option value="sunday">Sunday</option>
              <option value="regional">Regional</option>
            </select>
          </Field>
          <Field label="Department">
            <select
              required
              value={state.department_id}
              onChange={(e) =>
                setState((s) => ({ ...s, department_id: e.target.value }))
              }
              className={inputClasses}
            >
              <option value="">Select…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
              className={inputClasses}
            />
          </Field>
          <Field label="Time">
            <input
              placeholder="e.g. 6:00 PM - 9:00 PM"
              maxLength={50}
              value={state.time}
              onChange={(e) => setState((s) => ({ ...s, time: e.target.value }))}
              className={inputClasses}
            />
          </Field>
        </div>

        <Field label="Location">
          <input
            maxLength={200}
            value={state.location}
            onChange={(e) => setState((s) => ({ ...s, location: e.target.value }))}
            className={inputClasses}
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            maxLength={2000}
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            className={`${inputClasses} resize-vertical`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Expected Attendance">
            <input
              type="number"
              min={0}
              max={1_000_000}
              value={state.expected_attendance}
              onChange={(e) =>
                setState((s) => ({ ...s, expected_attendance: e.target.value }))
              }
              className={inputClasses}
            />
          </Field>
          <Field label="Budget (optional)">
            <input
              type="number"
              min={0}
              max={1_000_000_000}
              value={state.budget}
              onChange={(e) => setState((s) => ({ ...s, budget: e.target.value }))}
              className={inputClasses}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-[12px] text-[color:var(--cal-status-deleted-text)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cal-border pt-4">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle"
          >
            {isEditing ? "Update Draft" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Submit Request
          </button>
        </div>
      </form>
    </dialog>
  );
});

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired. Please sign in again.";
    case "forbidden":
      return "You don't have permission for this.";
    case "not_owner":
      return "You can only edit your own drafts.";
    case "not_draft":
      return "Only drafts can be edited.";
    case "invalid_payload":
      return "Some required fields are missing or invalid.";
    case "invalid_state":
      return "Request can no longer be submitted in its current state.";
    default:
      return "Couldn't save. Try again.";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClasses =
  "rounded-lg border border-cal-border bg-cal-bg px-3.5 py-2 text-[14px] text-cal-text placeholder:text-cal-text-muted hover:border-cal-bg-emphasis focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15";
