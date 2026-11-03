import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { monthAttendance } from "@/lib/codes";
import { unitList } from "@/lib/employees";
import { clock, hhmm, type Duty } from "@/lib/engine/duty";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const coffText = (c: number) => (c > 0 ? `+${c}` : c < 0 ? `${c}`.replace("-", "−") : "");

export default async function TimeCompliance({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string; half?: string; flagged?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const punchUnits = units.filter((u) => u.mode === "punch");
  const unit = sp.unit ?? punchUnits[0]?.code;
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const tc = unit ? await monthAttendance(unit, y, m) : null;
  const half = sp.half === "2" ? 2 : 1;
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ unit, month, half: String(half), flagged: sp.flagged, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const monthOptions = [...new Set(months.map((x) => x.month))];

  const days = tc ? (half === 1 ? [...Array(16)].map((_, i) => i + 1) : [...Array(tc.days - 16)].map((_, i) => i + 17)) : [];
  const people = (tc?.persons ?? []).filter((p) => sp.flagged !== "1" || p.duties.some((d) => d.flags.length || d.late) || !p.known);

  return (
    <>
      <Crumbs items={[["Attendance"], ["Time Compliance"]]} />
      <PageHead title="Time Compliance" sub="Built straight from the punches · IN = first entry, OUT = last exit of the duty · a night shift shows on the day it started">
        {tc ? <a className="btn" href={`/portal/attendance/time-compliance/export?unit=${unit}&month=${month}`}><Icon name="download" size="sm" />Time Compliance .xlsx</a> : null}
        <Link className="btn" href="/portal/attendance/upload"><Icon name="upload" size="sm" />Upload punches</Link>
      </PageHead>

      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="unit" defaultValue={unit}>
          {punchUnits.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.workOrders.join(", ") || "drivers"}</option>)}
        </select>
        <select className="select" name="month" defaultValue={month}>
          {(monthOptions.length ? monthOptions : [month]).map((mo) => <option key={mo} value={mo}>{new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
        <input type="hidden" name="half" value={half} />
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto" />
        <Link className={`chip ${sp.flagged === "1" ? "on" : ""}`} href={qs({ flagged: sp.flagged === "1" ? undefined : "1" })}><Icon name="alert" size="sm" />Only people with flags</Link>
      </form>

      {!tc ? <div className="card"><div className="empty">Choose a unit.</div></div> : tc.people.every((p) => !p.duties.length) ? (
        <div className="card"><div className="empty"><div className="big"><Icon name="calendar" size="lg" /></div><b>No punches for {unit} in {month}</b>
          <p className="muted"><Link href="/portal/attendance/upload">Upload the punch files</Link> for this month.</p></div></div>
      ) : (
        <>
          <div className="grid g5" style={{ marginBottom: 16 }}>
            {[["Cards with punches", tc.summary.cards], ["Matched to employees", `${tc.summary.known} / ${tc.summary.cards}`], ["Missing IN / OUT", tc.summary.missingPunch],
              ["Late arrivals", tc.summary.late], ["C-Off (net, hours)", (tc.summary.coffNet > 0 ? "+" : "") + tc.summary.coffNet]].map(([l, v]) => (
              <div key={String(l)} className="card kpi"><div className="lbl">{l}</div><div className="val" style={{ fontSize: 22 }}>{v}</div></div>))}
          </div>
          {tc.summary.unknown || tc.summary.noPunchPeople ? (
            <div className="alert warn" style={{ marginBottom: 12 }}><Icon name="alert" size="sm" /><div>
              {tc.summary.unknown ? <><b>{tc.summary.unknown} card{tc.summary.unknown > 1 ? "s" : ""} not in the employee master</b> punched on {tc.unit.code}&apos;s work order{tc.unit.workOrders.length > 1 ? "s" : ""} (marked below — add them as employees). </> : null}
              {tc.summary.noPunchPeople ? <>{tc.summary.noPunchPeople} employee{tc.summary.noPunchPeople > 1 ? "s" : ""} of {tc.unit.code} have no punches this month.</> : null}
            </div></div>) : null}
          <div className="card">
            <div className="toolbar">
              <div className="tabs" style={{ border: 0 }}>
                <Link className={`tab ${half === 1 ? "on" : ""}`} href={qs({ half: "1" })}>01–16</Link>
                <Link className={`tab ${half === 2 ? "on" : ""}`} href={qs({ half: "2" })}>17–{tc.days}</Link>
              </div>
              <span className="ml-auto dim" style={{ fontSize: 12 }}>No-punch days show the final code from <Link href={`/portal/attendance/review?unit=${unit}&month=${month}`}>Attendance Review</Link> · &ldquo;-&rdquo; = not yet joined</span>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 640 }}>
              <table className="tbl tc compact">
                <thead><tr><th style={{ position: "sticky", left: 0, zIndex: 3, minWidth: 210, textAlign: "left" }}>Employee</th><th></th>
                  {days.map((d) => { const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return <th key={d} className={wd === 0 ? "th-sun" : ""}>{String(d).padStart(2, "0")}<div className="dim" style={{ fontWeight: 400 }}>{DOW[wd]}</div></th>; })}
                </tr></thead>
                <tbody>{people.map((p) => {
                  const byDay = new Map(p.duties.map((d) => [d.day, d] as [number, Duty]));
                  const dutyDay = (d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const row = (kind: "IN" | "OUT" | "HRS" | "C-OFF", last = false) => (
                    <tr key={kind} className={last ? "grp-end" : ""}>
                      {kind === "IN" ? <td className="who" rowSpan={4}>
                        {p.employeeId ? <Link href={`/portal/employees/${p.employeeId}`} style={{ color: "var(--text)" }}><b>{p.name}</b></Link> : <b>{p.name || "—"}</b>}
                        <div className="dim" style={{ fontSize: 11 }}>{p.card}{p.designation ? ` · ${p.designation}` : ""}</div>
                        {!p.known ? <Link className="badge b-amber" style={{ height: 18, marginTop: 3 }} href={`/portal/employees/new?card=${p.card}&unit=${tc.unit.code}`}>Not in master — add</Link> : null}
                        {p.known && !p.duties.length ? <span className="badge b-grey" style={{ height: 18, marginTop: 3 }}>No punches</span> : null}
                      </td> : null}
                      <td className="lbl">{kind}</td>
                      {days.map((dd) => {
                        const x = byDay.get(dd);
                        if (!x) { const c = p.final[dd - 1] ?? ""; return kind === "IN" ? <td key={dd} rowSpan={4} className="codecell">{p.known ? <span className={`code ${c}`}>{c || "-"}</span> : null}</td> : null; }
                        if (kind === "IN") return <td key={dd} className={!x.inn ? "flag" : x.late ? "late" : ""} title={x.late ? `${x.shift} shift · ${x.late} min late` : x.shift ?? ""}>{x.inn ? clock(x.inn) : "Missing"}</td>;
                        if (kind === "OUT") return <td key={dd} className={!x.out ? "flag" : ""}>{clock(x.out, dutyDay(dd))}</td>;
                        if (kind === "HRS") return <td key={dd} title={x.flags.join("; ")} className={x.flags.some((f) => f.startsWith("span") || f.startsWith("very")) ? "flag" : ""}><b>{x.minutes !== null ? hhmm(x.minutes) : "-"}</b></td>;
                        return <td key={dd} className={x.coff > 0 ? "coff-p" : x.coff < 0 ? "coff-m" : ""}>{coffText(x.coff)}</td>;
                      })}
                    </tr>
                  );
                  return [row("IN"), row("OUT"), row("HRS"), row("C-OFF", true)];
                })}</tbody>
              </table>
            </div>
            <div className="card-b row wrap" style={{ borderTop: "1px solid var(--line)", fontSize: 12, gap: 14 }}>
              <span className="flag">Missing = punch not recorded</span><span className="late">Amber IN = late (hover for minutes)</span>
              <span className="coff-p">+ C-Off added</span><span className="coff-m">− C-Off deducted</span><span className="dim">(+1) = OUT next morning · red HRS = check punches</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
