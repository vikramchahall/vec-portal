import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/portal/Shell";
import Inbox from "@/components/portal/Inbox";

export const metadata: Metadata = { title: "Inbox", robots: { index: false } };

export default async function InboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: enquiries, error: eErr }, { data: applications, error: aErr }] =
    await Promise.all([
      supabase
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  const error = eErr ?? aErr;

  return (
    <Shell crumb={{ href: "/portal", label: "Sites" }}>
      <Link
        href="/portal"
        className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> All sites
      </Link>

      <div className="mt-5">
        <h1 className="font-display text-3xl text-chalk">Inbox</h1>
        <p className="mt-2 text-[13px] text-mist">
          Everything submitted through the public website.
        </p>
      </div>

      {error ? (
        <p className="mt-8 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[13px] text-accent-lit">
          Could not load: {error.message}
        </p>
      ) : (
        <div className="mt-10">
          <Inbox enquiries={enquiries ?? []} applications={applications ?? []} />
        </div>
      )}
    </Shell>
  );
}
