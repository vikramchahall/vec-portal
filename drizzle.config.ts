import { defineConfig } from "drizzle-kit";

// `npx drizzle-kit generate` writes SQL migrations to ./drizzle.
// They are applied on server start (instrumentation.ts), not by hand.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
