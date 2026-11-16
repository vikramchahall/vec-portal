import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import { DoneButton, ItemButton } from "./CalendarClient";

export const dynamic = "force-dynamic";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
const show = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${String(d).padStart(2, "0")} ${MON[m - 1]} ${y}`; };
const covers = (period: string, due: string) => {
  if (period !== "previous month") return period;
  const [y, m] = due.split("-").map(Number);
  return `${MON[(m + 10) % 12]} ${m === 1 ? y - 1 : y}`;
};

/** What is due, from 60 days back (so nothing overdue is missed) to 75 days ahead. */
export default async function Calendar() {
  const user = await requireUser();
  const owner = user.role === "owner";
  const d = db();
  const [items, done] = await Promise.all([d.select().from(schema.complianceItems).orderBy(asc(schema.complianceItems.sortOrder), asc(schema.complianceItems.id)), d.select().from(schema.complianceDone)]);
  const doneBy = new Map(done.map((x) => [`${x.itemId}|${x.dueDate}`, x]));
  const ist = (t: number) => new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 10);
  const today = ist(Date.now()), week = ist(Date.now() + 7 * 86400000);
  const from = new Date(Date.now() - 60 * 86400000), to = new Date(Date.now() + 75 * 86400000);
  const rows: { item: (typeof items)[number]; due: string }[] = [];
  for (const it of items.filter((x) => x.active)) {
    for (let t = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); t <= to; t.setUTCMonth(t.getUTCMonth() + 1)) {
      const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1;
      if (it.frequency !== "monthly" && !it.dueMonths.includes(m)) continue;
      const due = iso(y, m, it.dueDay);
      if (due >= from.toISOString().slice(0, 10) && due <= to.toISOString().slice(0, 10) && due >= it.trackFrom) rows.push({ item: it, due });
    }
  }
  rows.sort((a, b) => a.due.localeCompare(b.due));
  const state = (r: (typeof rows)[number]) => (doneBy.has(`${r.item.id}|${r.due}`) ? "done" : r.due < today ? "overdue" : r.due <= week ? "soon" : "later");
  // past items already done drop out of view; anything overdue stays on top
  const visible = rows.filter((r) => state(r) !== "done" || r.due >= today.slice(0, 8) + "01");
  const overdue = visible.filter((r) => state(r) === "overdue");
  const rest = visible.filter((r) => state(r) !== "overdue");
  const badge = { overdue: ["b-red", "Overdue"], soon: ["b-amber", "Due this week"], later: ["b-grey", "Upcoming"], done: ["b-green", "Done"] } as const;
  const Row = ({ r }: { r: (typeof rows)[number] }) => {
    const st = state(r), dn = doneBy.get(`${r.item.id}|${r.due}`);
    return (
      <tr>
        <td style={{ whiteSpace: "nowrap" }}><b>{show(r.due)}</b><div><span className={`badge ${badge[st][0]}`}>{badge[st][1]}</span></div></td>
        <td><b>{r.item.title}</b><div className="dim" style={{ fontSize: 12 }}>{[r.item.authority, r.item.appliesTo].filter(Boolean).join(" · ")}</div>
          {r.item.notes ? <div style={{ fontSize: 12, marginTop: 2 }}>{r.item.notes}</div> : null}</td>
        <td>{covers(r.item.period, r.due)}</td>
        <td><DoneButton itemId={r.item.id} dueDate={r.due} title={r.item.title} owner={owner}
          done={dn ? { reference: dn.reference, by: dn.doneBy, at: dn.doneAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) } : null} /></td>
      </tr>
    );
  };

  return (
    <>
      <Crumbs items={[["Statutory & Compliance"], ["Compliance Calendar"]]} />
      <PageHead title="Compliance calendar" sub="Filings and payments due in the next 75 days, and anything still open from the last 60 (counted from the day each obligation was added). Mark each one done with its challan or acknowledgement number.">
        {owner ? <ItemButton /> : null}
      </PageHead>
      {overdue.length ? <div className="alert err" style={{ marginBottom: 12 }}><Icon name="alert" size="sm" /><div><b>{overdue.length} overdue</b> — {overdue.map((r) => r.item.title).join(", ")}.</div></div> : null}
      <div className="card" style={{ marginBottom: 16 }}><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th style={{ width: 140 }}>Due</th><th>What</th><th>For</th><th style={{ width: 280 }}>Status</th></tr></thead>
        <tbody>{[...overdue, ...rest].map((r) => <Row key={`${r.item.id}-${r.due}`} r={r} />)}</tbody>
      </table></div></div>
      <div className="card">
        <div className="card-h"><Icon name="list" size="sm" /><h3>All obligations</h3><span className="right dim" style={{ fontSize: 12 }}>{owner ? "Edit a due day or add your own." : "Only the owner can edit."}</span></div>
        <div className="tbl-wrap"><table className="tbl compact">
          <thead><tr><th>What</th><th>How often</th><th>Due</th><th>Covers</th><th>Applies to</th><th></th></tr></thead>
          <tbody>{items.map((it) => (
            <tr key={it.id} style={{ opacity: it.active ? 1 : 0.5 }}>
              <td>{it.title}{it.active ? null : <span className="badge b-grey" style={{ marginLeft: 6 }}>off</span>}</td>
              <td>{it.frequency === "monthly" ? "Every month" : it.frequency === "half_yearly" ? "Twice a year" : "Once a year"}</td>
              <td>Day {it.dueDay}{it.dueMonths.length ? ` of ${it.dueMonths.map((m) => MON[m - 1]).join(", ")}` : ""}</td>
              <td>{it.period}</td><td>{it.appliesTo ?? ""}</td>
              <td>{owner ? <ItemButton item={{ id: it.id, title: it.title, authority: it.authority ?? "", frequency: it.frequency, dueDay: it.dueDay, dueMonths: it.dueMonths.join(", "), period: it.period, appliesTo: it.appliesTo ?? "", notes: it.notes ?? "", active: it.active }} /> : null}</td>
            </tr>))}</tbody>
        </table></div>
      </div>
    </>
  );
}
