"use client";

// Event Detail Modal — opens when a calendar chip (or, later, an
// event row) is clicked. PRD Section 7.8 modal behavior:
//
//   - rgba(0,0,0,0.5) backdrop, click to close
//   - Escape closes
//   - Focus trap inside the modal
//   - Initial focus on the close button (no inputs in this modal)
//   - Body scroll-lock while open
//   - z-index 50
//   - role="dialog", aria-modal="true", aria-labelledby = title
//
// We use the native HTML <dialog> element + showModal(), which gives
// us focus trap, Escape-to-close, return-focus-to-trigger, scroll-lock,
// and ARIA semantics for free. ::backdrop is styled in globals.css
// equivalent inline.
//
// Layout (PRD Section 8 FR-1 "Event Detail Modal"):
//   - No colored header. Grayscale layout.
//   - 4px vertical color bar inline with title + type badge.
//   - 10px uppercase labels, 13px values for date/time/location/dept.
//   - Description block below. Expected attendance in the metadata grid.
//   - Close X icon top-right.

import { Calendar, Clock, MapPin, Users, X } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { EventListItem } from "@/lib/cem/types";
import { parseEventDate, MONTHS_LONG } from "@/lib/cem/dates";

const TYPE_META: Record<EventListItem["type"], { label: string; hex: string }> = {
  sunday: { label: "Sunday", hex: "#0d9488" },
  regional: { label: "Regional", hex: "#7c3aed" },
  local: { label: "Local", hex: "#111827" },
};

export type EventDetailModalRef = {
  /** Open the modal showing the given event. */
  show: (event: EventListItem) => void;
  /** Close the modal. */
  close: () => void;
};

export const EventDetailModal = forwardRef<
  EventDetailModalRef,
  { event: EventListItem | null; onClose: () => void }
>(function EventDetailModal({ event, onClose }, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      show: () => {
        const d = dialogRef.current;
        if (d && !d.open) d.showModal();
      },
      close: () => dialogRef.current?.close(),
    }),
    [],
  );

  // Close handler — fires for both the X button and the native
  // dialog `close` event (Escape key, .close()).
  function handleClose() {
    onClose();
  }

  // Backdrop click: <dialog> renders the backdrop as a pseudo-element,
  // and clicks on the dialog itself include the backdrop region.
  // Detect by comparing target === dialog (not a child).
  function handleClickOutside(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  if (!event) {
    // Render an empty dialog so the ref is stable; nothing inside.
    return (
      <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="hidden"
        aria-hidden="true"
      />
    );
  }

  const { dayShort, dayNum, month, year } = parseEventDate(event.date);
  const dateLabel = `${dayShort}, ${MONTHS_LONG[month]} ${dayNum}, ${year}`;
  const typeMeta = TYPE_META[event.type];

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleClickOutside}
      aria-labelledby="event-modal-title"
      className="z-50 w-[calc(100vw-32px)] max-w-[500px] overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg p-0 text-cal-text shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop:bg-black/50 open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      {/* Header */}
      <div className="flex items-start gap-3.5 border-b border-cal-border px-6 py-5">
        <div
          className="mt-0.5 h-9 w-1 shrink-0 rounded-sm"
          style={{ backgroundColor: typeMeta.hex }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2
              id="event-modal-title"
              className="m-0 truncate font-display text-[18px] font-medium tracking-[-0.01em] text-cal-text"
            >
              {event.title}
            </h2>
            <span
              className="inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[10px] font-medium"
              style={{
                color: typeMeta.hex,
                backgroundColor: `${typeMeta.hex}10`,
                borderColor: `${typeMeta.hex}25`,
              }}
            >
              {typeMeta.label}
            </span>
          </div>
          {event.department_name ? (
            <div className="mt-1 text-[12px] text-cal-text-muted">{event.department_name}</div>
          ) : null}
        </div>
        <form method="dialog" className="contents">
          <button
            type="submit"
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        <dl className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={Calendar} label="Date" value={dateLabel} />
          {event.time ? <Field icon={Clock} label="Time" value={event.time} /> : null}
          {event.location ? <Field icon={MapPin} label="Location" value={event.location} /> : null}
          {event.expected_attendance != null ? (
            <Field
              icon={Users}
              label="Expected"
              value={`${event.expected_attendance} people`}
            />
          ) : null}
        </dl>

        {event.description ? (
          <>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-muted">
              Description
            </div>
            <p className="m-0 max-h-[40vh] overflow-y-auto text-[13px] leading-relaxed text-cal-text-secondary">
              {event.description}
            </p>
          </>
        ) : null}

        <div className="mt-5 flex justify-end">
          <form method="dialog" className="contents">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[12px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              Close
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
});

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-muted">
        {label}
      </dt>
      <dd className="m-0 flex items-center gap-1.5 text-[13px] font-medium text-cal-text">
        <Icon className="h-3.5 w-3.5 shrink-0 text-cal-text-muted" aria-hidden />
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
