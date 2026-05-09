// Seed the platform-wide curated scripture set.
//
// Run: npx tsx --env-file=.env scripts/seed-scriptures.ts
//
// Idempotent: skips references that already exist. Safe to re-run.
//
// Note: cem_scriptures is platform-global (no tenant_id). One curated
// list serves every tenant + the platform host.

import "dotenv/config";
import postgres from "postgres";

type SeedRow = {
  reference: string;
  theme: string;
};

// Curated set across faith / grace / spirit / hope / love.
// All references resolve cleanly in KJV / WEB / ASV.
const SEED: SeedRow[] = [
  // Faith
  { reference: "Hebrews 11:1", theme: "faith" },
  { reference: "Romans 10:17", theme: "faith" },
  { reference: "2 Corinthians 5:7", theme: "faith" },
  { reference: "Mark 11:24", theme: "faith" },
  { reference: "James 1:6", theme: "faith" },

  // Grace
  { reference: "Ephesians 2:8", theme: "grace" },
  { reference: "2 Corinthians 12:9", theme: "grace" },
  { reference: "Romans 5:20", theme: "grace" },
  { reference: "Hebrews 4:16", theme: "grace" },
  { reference: "Titus 2:11", theme: "grace" },

  // Spirit
  { reference: "Galatians 5:22", theme: "spirit" },
  { reference: "Romans 8:11", theme: "spirit" },
  { reference: "John 14:26", theme: "spirit" },
  { reference: "1 Corinthians 6:19", theme: "spirit" },
  { reference: "Acts 1:8", theme: "spirit" },

  // Hope
  { reference: "Romans 15:13", theme: "hope" },
  { reference: "Jeremiah 29:11", theme: "hope" },
  { reference: "Romans 8:24", theme: "hope" },
  { reference: "Hebrews 6:19", theme: "hope" },
  { reference: "Lamentations 3:22", theme: "hope" },

  // Love
  { reference: "John 3:16", theme: "love" },
  { reference: "1 Corinthians 13:4", theme: "love" },
  { reference: "1 John 4:8", theme: "love" },
  { reference: "Romans 8:38", theme: "love" },
  { reference: "1 John 4:19", theme: "love" },
];

(async () => {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL or DIRECT_URL not set");
    process.exit(1);
  }
  const sql = postgres(url);

  let added = 0;
  let skipped = 0;
  for (const row of SEED) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM cem_scriptures
      WHERE reference = ${row.reference}
      LIMIT 1
    `;
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await sql`
      INSERT INTO cem_scriptures (reference, default_translation, theme, active)
      VALUES (${row.reference}, 'KJV', ${row.theme}, true)
    `;
    added++;
  }
  console.log(`Platform scripture set: +${added} (skipped ${skipped} existing).`);

  await sql.end();
})();
