// Shown when a signed-in user lacks a role for the current tenant+app.
// Distinct from /login because they don't need to authenticate again —
// they just don't have permission.

import { signOutAction } from "@/lib/auth/actions";

export const metadata = {
  title: "Access denied | Church Event Management",
};

export default function NoAccessPage() {
  return (
    <main style={{ padding: 48, fontFamily: "system-ui, sans-serif", maxWidth: 480 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>You don't have access to this church</h1>
      <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>
        Your account is signed in, but you have no role assigned for this church or for the
        Event Management app. If you think this is wrong, contact your church administrator.
      </p>
      <form action={signOutAction} style={{ marginTop: 24 }}>
        <button type="submit" style={{ padding: "8px 14px" }}>
          Sign out
        </button>
      </form>
    </main>
  );
}
