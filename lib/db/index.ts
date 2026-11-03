import "server-only";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";

// One small pool per server process; the 1 GB server allows 20 connections in total.
const globalForDb = globalThis as unknown as { vecSql?: postgres.Sql };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.vecSql ??= postgres(url, { max: 5, idle_timeout: 30 });
  return globalForDb.vecSql;
}

export const isDbConfigured = () => Boolean(process.env.DATABASE_URL);

export function db() {
  return drizzle(client(), { schema });
}

/** Apply pending SQL migrations from ./drizzle (copied next to server.js in a release). */
export async function runMigrations() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    await sql.end();
  }
}

export { schema };
