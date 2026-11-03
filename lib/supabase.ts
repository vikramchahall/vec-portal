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
// SUPABASE_URL / SUPABASE_ANON_KEY are read when the server runs (Lightsail .env); the NEXT_PUBLIC_
// names are fixed at build time, which is how the Netlify build provided them.
const url0 = () => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key0 = () => process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getPublicClient() {
  const url = url0();
  const key = key0();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const isSupabaseConfigured = () => Boolean(url0() && key0());
