// NavBar — server component. Reads the current session and renders
// the role-appropriate navigation per PRD Section 9.
//
// Layout (52px tall, sticky top, max-width 1200px, 24px side padding):
//
//   [ Church Events ]   {Dashboard?} Calendar Departments Holidays Birthdays
//                                                                       [🌙] [Name] [Role] [🔔] [↪ Logout]
//   ──────────────────────────────────────────────────────────────────  border-bottom
//
//   When unauthenticated, the right side collapses to just the theme
//   toggle + a "Sign in" button.
//
// SECURITY (F05 checkpoint):
// - All role decisions happen server-side. The Dashboard link only
//   reaches the rendered HTML when getSession() confirmed the user
//   has Lead/Admin/Super role for this tenant+app. There's no
//   client-side gating that could leak role hints in a JS bundle.
// - Logout uses a <form action="/auth/logout" method="post"> — the
//   POST endpoint enforces same-origin; GET returns 405. See F03.
// - Role badge label is the canonical, predefined string per role; it
//   does not reflect any user-controlled data.

import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { RoleBadge } from "@/components/role-badge";
import { NavLink } from "@/components/nav/nav-link";

const APP_BASE = "/events";

// Per PRD Section 10: role → default dashboard route.
function dashboardHrefForRole(
  role: "lead" | "admin" | "superadmin" | "platform_admin",
): string {
  switch (role) {
    case "lead":
      return `${APP_BASE}/dashboard/lead`;
    case "admin":
      return `${APP_BASE}/dashboard/admin`;
    case "superadmin":
    case "platform_admin":
      return `${APP_BASE}/dashboard/super`;
  }
}

export async function NavBar() {
  const session = await getSession();
  const showDashboard = session && session.role !== "member";

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-cal-border bg-cal-bg/95 backdrop-blur supports-[backdrop-filter]:bg-cal-bg/80"
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-[52px] max-w-[1200px] items-stretch justify-between gap-6 px-6"
      >
        {/* ── Left: logo + nav links ─────────────────────────────── */}
        <div className="flex items-center gap-7">
          <Link
            href={APP_BASE}
            className="flex shrink-0 items-center font-display text-[18px] font-medium leading-none tracking-[-0.03em] text-cal-brand"
          >
            Church Events
          </Link>
          <ul className="flex h-full items-center gap-5">
            {showDashboard ? (
              <li className="flex h-full items-stretch">
                <NavLink
                  href={dashboardHrefForRole(session.role as "lead" | "admin" | "superadmin" | "platform_admin")}
                  label="Dashboard"
                  matchPrefix
                />
              </li>
            ) : null}
            <li className="flex h-full items-stretch">
              <NavLink href={APP_BASE} label="Calendar" />
            </li>
            <li className="flex h-full items-stretch">
              <NavLink href={`${APP_BASE}/departments`} label="Departments" />
            </li>
            <li className="flex h-full items-stretch">
              <NavLink href={`${APP_BASE}/holidays`} label="Holidays" />
            </li>
            <li className="flex h-full items-stretch">
              <NavLink href={`${APP_BASE}/birthdays`} label="Birthdays" />
            </li>
          </ul>
        </div>

        {/* ── Right: user actions ────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {session ? (
            <>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-cal-border" />
              <span className="text-[12px] font-medium text-cal-text-secondary">
                {session.name ?? session.email ?? "Signed in"}
              </span>
              <RoleBadge role={session.role} />
              <NotificationBell />
              {/* Logout: form-POST to /auth/logout. GET returns 405. */}
              <form action="/auth/logout" method="post" className="contents">
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cal-text-secondary transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="ml-1 inline-flex h-8 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
