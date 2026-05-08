// Placeholder root page. Replaced in F21 (Tenant App Launcher) for the
// platform domain and in F06 (Calendar) for tenant subdomains.

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16">
      <h1 className="font-display text-[28px] font-medium leading-tight">
        Church Event Management
      </h1>
      <p className="mt-2 text-[14px] text-cal-text-secondary">
        Bootstrapping. The first user-facing screen lands in F06 (Calendar).
      </p>
      <p className="mt-6 text-[13px] text-cal-text-muted">
        Visit{" "}
        <a
          className="text-cal-accent underline-offset-2 hover:underline"
          href="/design-tokens"
        >
          /design-tokens
        </a>{" "}
        to verify the design system, or{" "}
        <a
          className="text-cal-accent underline-offset-2 hover:underline"
          href="/login"
        >
          /login
        </a>{" "}
        to see the auth flow.
      </p>
    </main>
  );
}
