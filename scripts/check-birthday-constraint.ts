import "dotenv/config";
import postgres from "postgres";

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const sql = postgres(url);
  const constraints = await sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'cem_birthdays'::regclass
      AND contype = 'u'
  `;
  console.log("Unique constraints on cem_birthdays:", constraints);
  await sql.end();
})();
