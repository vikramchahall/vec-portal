import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for the public forms.
 *
 * Uses the ANON key, not the service role: the only writes the public site
 * makes are inserts into `enquiries` and `job_applications`, and the RLS
 * policies in docs/sql/01-website.sql already permit exactly that and nothing
 * else. Keeping the service-role key out of this path means a mistake here
 * cannot expose employee or payroll data later.
 */
export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
