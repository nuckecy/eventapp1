import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

// drizzle-kit runs DDL (CREATE TABLE, ALTER, etc.), which is not supported
// over Supabase's transaction-mode pooler. Always use the direct
// connection (port 5432) for migrations. Falls back to DATABASE_URL if
// DIRECT_URL isn't set (dev convenience).
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for drizzle-kit. Set it in .env.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
});
