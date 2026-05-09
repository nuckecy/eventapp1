import "dotenv/config";
import postgres from "postgres";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const sql = postgres(url);
  const dupes = await sql`
    SELECT tenant_id, user_id, COUNT(*) as n
    FROM cem_birthdays
    GROUP BY tenant_id, user_id
    HAVING COUNT(*) > 1
  `;
  console.log(JSON.stringify({ dupe_count: dupes.length, dupes }, null, 2));
  await sql.end();
})();
