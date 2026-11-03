import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { monthAttendance } from "@/lib/codes";
import { unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import ReviewGrid, { type GridPerson } from "./ReviewGrid";

const SEV: Record<string, [string, string]> = { block: ["b-red", "Blocking"], review: ["b-amber", "Review"], info: ["b-grey", "Info"] };

export default async function Review({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string; show?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const punchUnits = units.filter((u) => u.mode === "punch");
  const unit = sp.unit ?? punchUnits[0]?.code;
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const ma = unit ? await monthAttendance(unit, y, m) : null;
  const known = (ma?.persons ?? []).filter((p) => p.known && p.b);
  const people: GridPerson[] = known.map((p) => ({
    employeeId: p.employeeId!, card: p.card, name: p.name, designation: p.designation, final: p.final, raw: p.raw,
    overrides: Object.fromEntries(p.overrides), counts: p.b!.counts, bf: p.b!.bf, credit: p.b!.credit, used: p.b!.used, close: p.b!.close,
    coff: { excess: p.b!.coff.excess, less: p.b!.coff.less }, inDay: Object.fromEntries(p.duties.filter((d) => d.inn).map((d) => [d.day, d.inn!.slice(11, 16)])),
  }));
  const blocks = ma?.exceptions.filter((e) => e.severity === "block").length ?? 0;
  const showAll = sp.show === "all";
  const exList = (ma?.exceptions ?? []).filter((e) => showAll || e.severity !== "info").slice(0, showAll ? 500 : 40);
  const totals = known.reduce((a, p) => ({ pay: a.pay + p.b!.counts.payable, x: a.x + p.b!.counts.X, l: a.l + p.b!.counts.L, cl: a.cl + p.b!.counts.CL }), { pay: 0, x: 0, l: 0, cl: 0 });
  const siteName = units.find((u) => u.code === unit)?.siteName ?? "";

  return (
    <>
      <Crumbs items={[["Attendance"], ["Attendance Review"]]} />
      <PageHead title="Attendance review" sub="Day codes from the punches: weekly-off rule, holidays, then absences covered with L and CL — the Punch Attendance and Attendance Format sheets.">
        <Link className="btn" href={`/portal/attendance/time-compliance?unit=${unit}&month=${month}`}><Icon name="clock" size="sm" />Time Compliance</Link>
      </PageHead>
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="unit" defaultValue={unit}>{punchUnits.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}</select>
        <select className="select" name="month" defaultValue={month}>
          {[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
        {ma ? <span className="ml-auto badge b-grey">Status: {ma.run.status}</span> : null}
      </form>
      {!ma ? null : (
        <>
          <div className="grid g5" style={{ marginBottom: 16 }}>
            {[["Employees", known.length], ["Payable days", totals.pay], ["Covered by L / CL", `${totals.l} / ${totals.cl}`], ["X (unpaid) days", totals.x], ["Blocking exceptions", blocks]].map(([l, v]) => (
              <div key={String(l)} className="card kpi"><div className="lbl">{l}</div><div className="val" style={{ fontSize: 22, color: l === "Blocking exceptions" && blocks ? "var(--err)" : undefined }}>{v}</div></div>))}
          </div>
          {ma.exceptions.length ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-h"><h3>Exceptions</h3><span className="right">
                <Link className={`chip ${showAll ? "" : "on"}`} href={`?unit=${unit}&month=${month}`}>Blocking &amp; review</Link>
                <Link className={`chip ${showAll ? "on" : ""}`} href={`?unit=${unit}&month=${month}&show=all`}>All ({ma.exceptions.length})</Link></span></div>
              <div className="tbl-wrap" style={{ maxHeight: 300 }}><table className="tbl compact">
                <thead><tr><th>Type</th><th>Severity</th><th>Card</th><th>Employee</th><th>Detail</th><th></th></tr></thead>
                <tbody>{exList.map((e, i) => (
                  <tr key={i}><td className="mono" style={{ fontSize: 11.5 }}>{e.kind}</td><td><span className={`badge ${SEV[e.severity][0]}`}>{SEV[e.severity][1]}</span></td>
                    <td className="mono">{e.card}</td><td>{e.name}</td><td style={{ whiteSpace: "normal", minWidth: 320 }}>{e.detail}</td>
                    <td>{e.kind === "UNKNOWN_CARD" ? <Link className="btn sm" href={`/portal/employees/new?card=${e.card}&unit=${unit}`}>Add employee</Link>
                      : e.kind === "BELOW_MW" && e.employeeId ? <Link className="btn sm" href={`/portal/employees/${e.employeeId}/edit`}>Fix structure</Link>
                      : e.kind === "NO_OPENING_BALANCE" ? <Link className="btn sm" href="/portal/employees/import">Import</Link> : null}</td></tr>))}</tbody>
              </table></div>
            </div>) : null}
          {people.length ? <ReviewGrid unit={unit!} year={y} month={m} days={ma.days} holidays={ma.run.holidays} locked={ma.run.status !== "draft"} people={people} siteName={siteName} />
            : <div className="card"><div className="empty">No employees in {unit} for this month.</div></div>}
        </>
      )}
    </>
  );
}
