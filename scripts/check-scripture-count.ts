import "dotenv/config";
import postgres from "postgres";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const sql = postgres(url);
  const rows = await sql`SELECT COUNT(*) as n FROM cem_scriptures WHERE active = true`;
  const themes = await sql`
    SELECT theme, COUNT(*) as n
    FROM cem_scriptures
    WHERE active = true
    GROUP BY theme
    ORDER BY theme
  `;
  console.log({ active_count: rows[0].n, by_theme: themes });
  await sql.end();
})();
