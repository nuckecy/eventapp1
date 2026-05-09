import "dotenv/config";
import postgres from "postgres";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const sql = postgres(url);
  const tenants = await sql`SELECT id, slug, name, status FROM core_tenants ORDER BY created_at`;
  const users = await sql`SELECT id, email, name FROM core_users ORDER BY email`;
  const roleCount = await sql`SELECT tenant_id, COUNT(*) as n FROM core_tenant_user_roles GROUP BY tenant_id`;
  const eventCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_events GROUP BY tenant_id`;
  const deptCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_departments GROUP BY tenant_id`;
  const birthdayCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_birthdays GROUP BY tenant_id`;
  const holidayCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_holidays GROUP BY tenant_id`;
  const requestCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_requests GROUP BY tenant_id`;
  const auditCount = await sql`SELECT tenant_id, COUNT(*) as n FROM cem_audit_log GROUP BY tenant_id`;
  console.log({
    tenants,
    user_count: users.length,
    user_emails: users.map(u => u.email),
    by_tenant: {
      roles: roleCount,
      events: eventCount,
      departments: deptCount,
      birthdays: birthdayCount,
      holidays: holidayCount,
      requests: requestCount,
      audit: auditCount,
    },
  });
  await sql.end();
})();
