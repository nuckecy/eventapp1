// Lead Dashboard — F14 stub.
// Auth-gated: only Lead role should land here. F14 will add the
// requireAuth() guard with a role check; for now we stub it so the
// nav link resolves.

export const metadata = { title: "Lead Dashboard · Church Event Management" };

export default function LeadDashboardStubPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="font-display text-[28px] font-medium">Lead Dashboard</h1>
      <p className="mt-1 text-[13px] text-cal-text-secondary">
        Request list + create form land in F14.
      </p>
    </div>
  );
}
