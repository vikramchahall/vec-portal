import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { unitList } from "@/lib/employees";
import { monthSalary } from "@/lib/payroll";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, inr } from "@/components/vec/ui";
import AdjustButton from "./AdjustButton";

const n = (x: number) => Math.round(x).toLocaleString("en-IN");
const COLS: [string, string][] = [["payableDays", "Pay days"], ["lop", "LOP"], ["earnedBasicDa", "Basic+DA"], ["earnedHra", "HRA"], ["gross", "Gross"], ["hpAmount", "HP"],
  ["totalEarning", "Total earning"], ["pf", "PF 12%"], ["esi", "ESIC 0.75%"], ["lwf", "LWF"], ["bonus", "Bonus 8.33%"], ["net", "Net"], ["pt", "PT"], ["netAfterPt", "Net after PT"],
  ["pfEmployer", "PF 13%"], ["esiEmployer", "ESIC 3.25%"], ["ctc", "CTC"]];
const GROUPS: [string, number][] = [["Attendance", 2], ["Earnings", 5], ["Employee deductions / bonus", 4], ["Net", 3], ["Employer", 3]];

export default async function WorkingSalary({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const punchUnits = units.filter((u) => u.mode === "punch");
  const unit = sp.unit ?? punchUnits[0]?.code;
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const ms = unit ? await monthSalary(unit, y, m) : null;
  const t = ms?.totals ?? {};
  const problems = ms?.rows.filter((r) => r.problem) ?? [];
  const blocks = ms?.exceptions.filter((e) => e.severity === "block").length ?? 0;

  return (
    <>
      <Crumbs items={[["Payroll"], ["Working Salary"]]} />
      <PageHead title={`Working Salary${unit ? ` · ${unit}` : ""}`} sub="Same columns and rounding as the Working Salary sheet, from the final day codes and each person's pay structure.">
        {ms ? <>
          <a className="btn" href={`/portal/payroll/working-salary/export?unit=${unit}&month=${month}`}><Icon name="download" size="sm" />Working Salary .xlsx</a>
          <Link className="btn" href={`/portal/payroll/payslips?unit=${unit}&month=${month}`}><Icon name="receipt" size="sm" />Payslips</Link>
        </> : null}
      </PageHead>
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="unit" defaultValue={unit}>{punchUnits.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}</select>
        <select className="select" name="month" defaultValue={month}>
          {[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto dim" style={{ fontSize: 12 }}>{ms ? `${ms.days} days · PF ceiling ₹${n(ms.settings.pfCeiling)} · PT ₹${ms.settings.ptAmount} above ₹${n(ms.settings.ptAnnualAbove)} a year · HP = gross ÷ ${ms.settings.hpDivisor}` : ""}</span>
      </form>
      {!ms ? null : (
        <>
          <div className="card" style={{ marginBottom: 16 }}><div className="card-b row wrap" style={{ gap: 28 }}>
            {[["Employees", n(t.people)], ["Payable days", n(t.payableDays)], ["Total earning", inr(t.totalEarning)], ["PF (employee)", inr(t.pf)], ["ESIC (employee)", inr(t.esi)], ["Net payable after PT", inr(t.netAfterPt)], ["CTC for billing", inr(t.ctcBilling)]].map(([l, v]) => (
              <div key={l}><div className="dim" style={{ fontSize: 12 }}>{l}</div><div style={{ font: "600 18px var(--display)" }}>{v}</div></div>))}
          </div></div>
          {blocks || problems.length ? <div className="alert warn" style={{ marginBottom: 12 }}><Icon name="alert" size="sm" /><div>
            {blocks ? <><b>{blocks} blocking exception{blocks > 1 ? "s" : ""}</b> in <Link href={`/portal/attendance/review?unit=${unit}&month=${month}`}>Attendance Review</Link> — clear them before approval. </> : null}
            {problems.length ? <>{problems.length} without a pay structure: {problems.map((r) => r.p.name).join(", ")}.</> : null}
          </div></div> : null}
          <div className="card">
            <div className="tbl-wrap" style={{ maxHeight: 640 }}><table className="tbl ws compact">
              <thead>
                <tr><th className="grp stick" colSpan={2} />{GROUPS.map(([g, span]) => <th key={g} className="grp" colSpan={span}>{g}</th>)}</tr>
                <tr><th className="stick" style={{ minWidth: 92 }}>Card</th><th className="stick2" style={{ minWidth: 190 }}>Name</th>{COLS.map(([, h]) => <th key={h} className="num">{h}</th>)}<th>Entries</th></tr>
              </thead>
              <tbody>{ms.rows.map((r) => (
                <tr key={r.p.card}>
                  <td className="stick mono">{r.p.card}</td>
                  <td className="stick2"><Link href={`/portal/employees/${r.p.employeeId}?tab=employment`}>{r.p.name}</Link><div className="dim" style={{ fontSize: 11 }}>{r.p.designation ?? ""}{r.structure ? ` · ₹${n(r.structure.basicDa)}${r.structure.hra ? ` + HRA ${n(r.structure.hra)}` : ""}` : ""}</div></td>
                  {r.line ? COLS.map(([k]) => <td key={k} className={`num ${k === "netAfterPt" ? "net" : ""}`} style={k === "lop" && r.line!.lop ? { color: "var(--err)" } : undefined}>{n((r.line as unknown as Record<string, number>)[k])}</td>)
                    : <td colSpan={COLS.length} style={{ color: "var(--err)" }}>{r.problem} — <Link href={`/portal/employees/${r.p.employeeId}/edit`}>add the structure</Link></td>}
                  <td><AdjustButton unit={unit!} year={y} month={m} employeeId={r.p.employeeId!} name={r.p.name} adj={r.adj} locked={ms.run.status === "locked"} /></td>
                </tr>))}</tbody>
              <tfoot><tr><td className="stick" /><td className="stick2">Total ({t.people})</td>
                {COLS.map(([k]) => <td key={k} className="num">{["lop", "earnedBasicDa", "earnedHra"].includes(k) ? n(ms.rows.reduce((s, r) => s + (r.line ? (r.line as unknown as Record<string, number>)[k] : 0), 0)) : n(t[k] ?? 0)}</td>)}<td /></tr></tfoot>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}
