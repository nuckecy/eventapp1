// Drizzle client — Supabase Postgres via the postgres-js driver.
// PRD Section 4 Option A (Supabase + Vercel).
//
// SECURITY:
// - Connection string read from env (never hardcoded). See .env.example.
// - SSL required for any non-localhost host (PRD Section 16,
//   "SSL required for database connection"). Supabase always serves over
//   TLS, so we set ssl: "require".
// - We import all schema modules so `db` is fully typed for relational
//   queries.
// - `prepare: false` is needed when running through Supabase's transaction
//   pooler (port 6543); harmless on direct connections (port 5432).

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Create .env from .env.example and provide a Supabase connection string.",
  );
}

function shouldRequireSsl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
    return !localHosts.has(parsed.hostname);
  } catch {
    return true;
  }
}

// In dev, hot-reload would otherwise create a new client on every reload.
// Reuse a single client via a global guard.
declare global {
  // eslint-disable-next-line no-var
  var __cem_pg_client: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__cem_pg_client ??
  postgres(connectionString, {
    ssl: shouldRequireSsl(connectionString) ? "require" : false,
    max: 10,
    idle_timeout: 30,
    // Required when running through a transaction-mode pooler.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__cem_pg_client = client;
}

export const db = drizzle(client, { schema });

// Re-export for convenience.
export { schema };
export type Database = typeof db;
