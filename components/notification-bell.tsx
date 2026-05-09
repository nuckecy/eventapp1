// Notification bell + dropdown (F17).
//
// SECURITY:
// - Initial unread count is rendered server-side (so anon visitors and
//   users without a session never see "0" leak — they don't get the
//   bell at all). The dropdown content is fetched lazily via a server
//   action keyed to the authenticated session — RLS on cem_notifications
//   plus the WHERE user_id=... clause means no other user's rows can
//   ever come back, even if this client component is tricked into
//   sending an unexpected payload.
// - Mute / mark-read mutations are delegated to server actions which
//   re-validate the session and check the notification belongs to the
//   caller before writing.

"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  fetchOwnNotificationsAction,
  markNotificationReadAction,
  toggleNotificationMuteAction,
  type NotificationDTO,
} from "@/lib/cem/notification-actions";

type Props = {
  /** Server-supplied initial unread count. Defaults to 0 for anon users. */
  initialUnread?: number;
  /** Whether to render a clickable dropdown (only when authenticated). */
  authenticated?: boolean;
};

export function NotificationBell({
  initialUnread = 0,
  authenticated = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [unread, setUnread] = useState<number>(initialUnread);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const display = unread > 99 ? "99+" : String(unread);

  // Click outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function loadItems() {
    const r = await fetchOwnNotificationsAction();
    if (r.ok) {
      setItems(r.items);
      setUnread(r.unread);
    }
  }

  function toggleOpen() {
    if (!authenticated) return;
    if (!open && items === null) loadItems();
    setOpen((v) => !v);
  }

  function handleMarkRead(id: string) {
    setItems((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, read: true } : n)) : prev,
    );
    setUnread((u) => Math.max(0, u - 1));
    startTransition(() => {
      markNotificationReadAction(id).then((r) => {
        if (!r.ok) loadItems();
      });
    });
  }

  function handleToggleMute(id: string, currentlyMuted: boolean) {
    setItems((prev) =>
      prev
        ? prev.map((n) => (n.id === id ? { ...n, muted: !currentlyMuted } : n))
        : prev,
    );
    startTransition(() => {
      toggleNotificationMuteAction(id, !currentlyMuted).then((r) => {
        if (!r.ok) loadItems();
      });
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={
          unread === 1 ? "1 unread notification" : `${unread} unread notifications`
        }
        aria-haspopup={authenticated ? "menu" : undefined}
        aria-expanded={authenticated ? open : undefined}
        disabled={!authenticated}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#dc2626] px-0.5 text-[9px] font-semibold leading-none text-white"
            aria-hidden="true"
          >
            {display}
          </span>
        ) : null}
      </button>

      {open && authenticated ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-50 max-h-[420px] w-[340px] overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-cal-border px-3 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-cal-text-secondary">
              Notifications
            </span>
            <span className="text-[11px] text-cal-text-muted">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </span>
          </div>

          <ul className="max-h-[360px] overflow-y-auto">
            {items === null ? (
              <li className="px-4 py-6 text-center text-[12px] text-cal-text-muted">
                Loading…
              </li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12px] text-cal-text-muted">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`group flex flex-col gap-1 border-b border-cal-border px-3 py-2.5 last:border-b-0 ${
                    n.muted ? "opacity-50" : ""
                  } ${n.read ? "" : "bg-cal-bg-subtle"}`}
                >
                  <div className="flex items-start gap-2">
                    {n.read ? null : (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cal-brand"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-cal-text">
                        {n.title}
                      </div>
                      {n.body ? (
                        <div className="mt-0.5 text-[11px] leading-snug text-cal-text-secondary">
                          {n.body}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-cal-text-muted">
                        {formatRelative(n.created_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!n.read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-cal-text-secondary hover:bg-cal-bg-muted hover:text-cal-text"
                        >
                          Mark read
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleToggleMute(n.id, n.muted)}
                        title={n.muted ? "Unmute" : "Mute"}
                        aria-label={n.muted ? "Unmute notification" : "Mute notification"}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-cal-text-muted hover:bg-cal-bg-muted hover:text-cal-text"
                      >
                        <BellOff className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
