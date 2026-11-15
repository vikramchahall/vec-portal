import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import StatusCell from "./StatusCell";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { enquiry: "Enquiry", tender_invite: "Tender invite", vendor_registration: "Vendor registration" };
const when = (d: Date) => d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Messages and job applications sent from the public website's forms. */
export default async function Enquiries({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "jobs" ? "jobs" : "enquiries";
  const open = sp.show !== "all";
  const d = db();
  const [counts] = (await d.execute(sql`SELECT (SELECT count(*) FROM enquiries WHERE status = 'new')::int AS e, (SELECT count(*) FROM job_applications WHERE status = 'new')::int AS j`)) as unknown as { e: number; j: number }[];
  const enq = tab === "enquiries" ? await d.select().from(schema.enquiries).where(open ? sql`${schema.enquiries.status} <> 'closed'` : sql`true`).orderBy(desc(schema.enquiries.createdAt)).limit(300) : [];
  const jobs = tab === "jobs" ? await d.select().from(schema.jobApplications).where(open ? sql`${schema.jobApplications.status} <> 'not_suitable'` : sql`true`).orderBy(desc(schema.jobApplications.createdAt)).limit(300) : [];
  const q = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ tab, show: sp.show, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <Crumbs items={[["Operations"], ["Website enquiries"]]} />
      <PageHead title="Website enquiries" sub="Sent from the contact, tender / vendor and careers forms on vikramengineeringco.in. Newest first." />
      <div className="card">
        <div className="tabs" style={{ padding: "0 12px" }}>
          <Link className={`tab ${tab === "enquiries" ? "on" : ""}`} href={q({ tab: "enquiries" })}>Enquiries {counts.e ? <span className="count">{counts.e} new</span> : null}</Link>
          <Link className={`tab ${tab === "jobs" ? "on" : ""}`} href={q({ tab: "jobs" })}>Job applications {counts.j ? <span className="count">{counts.j} new</span> : null}</Link>
          <span className="right row" style={{ alignSelf: "center", gap: 6 }}>
            <Link className={`chip ${open ? "on" : ""}`} href={q({ show: undefined })}>Open</Link>
            <Link className={`chip ${open ? "" : "on"}`} href={q({ show: "all" })}>All</Link>
          </span>
        </div>
        {tab === "enquiries" ? (enq.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Received</th><th>From</th><th>Type</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>{enq.map((e) => (
            <tr key={e.id} style={{ verticalAlign: "top" }}>
              <td style={{ whiteSpace: "nowrap" }}>{when(e.createdAt)}{e.status === "new" ? <div><span className="badge b-blue">New</span></div> : null}</td>
              <td><b>{e.name}</b>{e.company ? <div className="dim">{e.company}</div> : null}
                {e.phone ? <div><a className="row" style={{ gap: 4 }} href={`tel:${e.phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size="sm" />{e.phone}</a></div> : null}
                {e.email ? <div><a className="row" style={{ gap: 4 }} href={`mailto:${e.email}`}><Icon name="mail" size="sm" />{e.email}</a></div> : null}</td>
              <td>{TYPE[e.type] ?? e.type}</td>
              <td style={{ whiteSpace: "pre-wrap", maxWidth: 460 }}>{e.message}</td>
              <td><StatusCell kind="enquiry" id={e.id} status={e.status} note={e.note} options={["new", "replied", "closed"]} /></td>
            </tr>))}</tbody>
        </table></div> : <div className="empty">No {open ? "open " : ""}enquiries yet.</div>)
        : (jobs.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Received</th><th>Applicant</th><th>Post</th><th className="num">Experience</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>{jobs.map((j) => (
            <tr key={j.id} style={{ verticalAlign: "top" }}>
              <td style={{ whiteSpace: "nowrap" }}>{when(j.createdAt)}{j.status === "new" ? <div><span className="badge b-blue">New</span></div> : null}</td>
              <td><b>{j.name}</b>{j.city ? <div className="dim">{j.city}</div> : null}
                <div><a className="row" style={{ gap: 4 }} href={`tel:${j.phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size="sm" />{j.phone}</a></div>
                {j.email ? <div><a className="row" style={{ gap: 4 }} href={`mailto:${j.email}`}><Icon name="mail" size="sm" />{j.email}</a></div> : null}</td>
              <td>{j.position}</td>
              <td className="num">{j.experienceYears ?? "—"}{j.experienceYears !== null ? " yrs" : ""}</td>
              <td style={{ whiteSpace: "pre-wrap", maxWidth: 380 }}>{j.message ?? ""}</td>
              <td><StatusCell kind="application" id={j.id} status={j.status} note={j.note} options={["new", "called", "shortlisted", "not_suitable"]} /></td>
            </tr>))}</tbody>
        </table></div> : <div className="empty">No {open ? "open " : ""}job applications yet.</div>)}
      </div>
    </>
  );
}
