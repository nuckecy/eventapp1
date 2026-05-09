"use client";

// FeedbackModal — used by Admin's "Return" action. PRD says "Feedback
// (Return to Lead)" is a 440-px modal. Built on the native <dialog>.

import { X } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnRequestAction } from "@/lib/cem/request-actions";
import { useToast } from "@/components/cem/toast";

export type FeedbackModalRef = {
  open: (requestId: string, requestTitle: string) => void;
};

export const FeedbackModal = forwardRef<FeedbackModalRef>(function FeedbackModal(
  _props,
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useImperativeHandle(
    ref,
    () => ({
      open: (id, title) => {
        setRequestId(id);
        setRequestTitle(title);
        setFeedback("");
        setError(null);
        dialogRef.current?.showModal();
      },
    }),
    [],
  );

  function close() {
    dialogRef.current?.close();
  }

  async function submit() {
    if (!requestId) return;
    setError(null);
    if (feedback.trim().length < 10) {
      setError("Please provide specific feedback (at least 10 characters).");
      return;
    }
    setBusy(true);
    try {
      const result = await returnRequestAction({
        requestId,
        feedback: feedback.trim(),
      });
      if (!result.ok) {
        setError(humanError(result.error));
        toast.show("error", humanError(result.error));
        return;
      }
      toast.show("success", "Returned for revision.");
      close();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      aria-labelledby="feedback-modal-title"
      className="z-50 w-[calc(100vw-32px)] max-w-[440px] overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg p-0 text-cal-text shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between border-b border-cal-border px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2
            id="feedback-modal-title"
            className="m-0 font-display text-[18px] font-medium tracking-[-0.01em]"
          >
            Return for revision
          </h2>
          {requestTitle ? (
            <p className="mt-0.5 truncate text-[12px] text-cal-text-muted">{requestTitle}</p>
          ) : null}
        </div>
        <form method="dialog">
          <button
            type="submit"
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="grid gap-4 px-6 py-5"
      >
        <label className="grid gap-1.5">
          <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-cal-text-secondary">
            Feedback
          </span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Explain what needs to change before this can move forward."
            className="resize-vertical rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
          />
          <span className="text-[10px] text-cal-text-muted">
            Minimum 10 characters. The lead will see this in their dashboard.
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-[12px] text-[color:var(--cal-status-deleted-text)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-cal-border pt-4">
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
            className="inline-flex h-9 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Returning…" : "Return to Lead"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired.";
    case "forbidden":
      return "Admin only.";
    case "invalid_state":
      return "Request can no longer be returned.";
    case "not_claimer":
      return "Only the admin who claimed this can return it.";
    default:
      return "Couldn't return. Try again.";
  }
}
