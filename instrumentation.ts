/**
 * Runs once when the server starts. Applies database migrations so a release
 * never needs a manual step on the server. Skipped where there is no database
 * (the Netlify website build).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { runMigrations } = await import("./lib/db");
  await runMigrations();
  console.log("database migrations applied");
}
