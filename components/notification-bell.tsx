// Notification bell — F05 placeholder. Renders the icon + an
// optional unread count badge. The real dropdown content + read/mute
// behavior arrives in F17. F05's PRD checkpoint says "notification bell
// placeholder" explicitly.
//
// Marked "use client" because the live count would normally come from
// a client subscription; for now we only consume an optional `count`
// prop (defaults to 0).

"use client";

import { Bell } from "lucide-react";

export function NotificationBell({ count = 0 }: { count?: number }) {
  const display = count > 99 ? "99+" : String(count);
  return (
    <button
      type="button"
      aria-label={count === 1 ? "1 unread notification" : `${count} unread notifications`}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {count > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#dc2626] px-0.5 text-[9px] font-semibold leading-none text-white"
          aria-hidden="true"
        >
          {display}
        </span>
      ) : null}
    </button>
  );
}
