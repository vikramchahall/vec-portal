import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Site } from "@/lib/types";
import Shell from "@/components/portal/Shell";
import AddSite from "@/components/portal/AddSite";

export const metadata: Metadata = { title: "Sites", robots: { index: false } };

export default async function PortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: sites, error } = await supabase
    .from("sites")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  // One query for all headcounts beats one per site.
  const { data: counts } = await supabase
    .from("employees")
    .select("site_id")
    .eq("status", "active");

  const headcount = new Map<string, number>();
  for (const row of counts ?? []) {
    headcount.set(row.site_id, (headcount.get(row.site_id) ?? 0) + 1);
  }

  return (
    <Shell>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {profile?.role === "admin" ? "Administrator" : "HR"}
          </p>
          <h1 className="mt-2 font-display text-3xl text-chalk">
            {profile?.full_name ? `Welcome, ${profile.full_name}.` : "Sites"}
          </h1>
          <p className="mt-2 text-[13px] text-mist">
            Open a site to see its employees.
          </p>
        </div>
        <AddSite />
      </div>

      {error ? (
        <p className="mt-8 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[13px] text-accent-lit">
          Could not load sites: {error.message}. Have you run{" "}
          <code>docs/sql/04-sites-employees.sql</code>?
        </p>
      ) : null}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(sites ?? []).map((s: Site) => (
          <Link
            key={s.id}
            href={`/portal/sites/${s.id}`}
            className="plate ticks group block border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
                {s.code}
              </span>
              {s.is_active ? (
                <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Live
                </span>
              ) : null}
            </div>

            <h2 className="mt-4 font-display text-lg leading-snug text-chalk">
              {s.name}
            </h2>
            <p className="mt-2 text-[12px] text-mist">{s.client_name ?? "—"}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-faint">
              {[s.city, s.state].filter(Boolean).join(", ") || "—"}
            </p>

            <p className="mt-5 border-t border-line pt-4 text-[12px] text-chalk">
              <span className="font-display text-xl">
                {headcount.get(s.id) ?? 0}
              </span>{" "}
              <span className="text-faint">on roll</span>
            </p>
          </Link>
        ))}
      </div>

      {sites && sites.length === 0 && !error ? (
        <p className="mt-8 border border-line bg-surface p-8 text-center text-[13px] text-mist">
          No sites yet. Add one above.
        </p>
      ) : null}
    </Shell>
  );
}
