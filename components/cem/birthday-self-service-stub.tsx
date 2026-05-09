// Self-service bar — F10 placeholder. F11 will replace it with the
// real edit-birthday flow (day/month/year dropdowns + "Show my age"
// checkbox + Save/Cancel + toast). For F10 we just show a static
// placeholder card so the layout matches the prototype.
//
// SECURITY (F11 will own the actual writes):
// The real implementation will fetch the current user's own birthday
// via /api/me/birthday — the only endpoint where year is allowed to
// be returned. This stub does NOT fetch or render the year.

import { User } from "lucide-react";

export function BirthdaySelfServiceStub({ userName }: { userName: string }) {
  return (
    <div className="mb-6 rounded-lg border border-cal-border bg-cal-card-bg px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-[13px] text-cal-text">
          <User className="h-4 w-4 text-cal-text-muted" aria-hidden="true" />
          <span>
            Hi {userName.split(" ")[0]} — your birthday self-service bar lands in F11.
          </span>
        </div>
      </div>
    </div>
  );
}
