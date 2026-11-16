import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dataMonths, headcount, salaryByUnitMonth, type UnitMonth } from "@/lib/reports";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, inr } from "@/components/vec/ui";

export const dynamic = "force-dynamic";
const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const lakh = (x: number) => (x >= 100000 ? `₹${(x / 100000).toFixed(2)} L` : inr(x));
const STATUS: Record<string, string> = { draft: "b-grey", approved: "b-blue", locked: "b-lock" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const n = Math.min(12, Math.max(1, Number(sp.n) || 6));
  const { all } = await dataMonths();
  const months = all.slice(0, n);
  const [rows, hc] = await Promise.all([salaryByUnitMonth(months), headcount(months)]);
  const byMonth = months.map((mo) => {
    const rs = rows.filter((r) => r.month === mo);
    const s = (k: keyof UnitMonth) => rs.reduce((a, r) => a + (r[k] as number), 0);
    return { month: mo, people: s("people"), totalEarning: s("totalEarning"), net: s("net"), pf: s("pfEE") + s("pfER"), esi: s("esiEE") + s("esiER"), ctc: s("ctc"), billing: s("ctcBilling"), payable: s("payableDays"), lop: s("lop") };
  });
  const maxCtc = Math.max(1, ...byMonth.map((x) => x.ctc));
  const units = [...new Set(rows.map((r) => r.unit))];
  const latest = byMonth[0];

  return (
    <>
      <Crumbs items={[["Reports & Analytics"], ["Reports"]]} />
      <PageHead title="Reports & analytics" sub="From each unit's Working Salary (locked months from their frozen copy) and the employee master.">
        <a className="btn" href={`/portal/reports/export?n=${n}`}><Icon name="download" size="sm" />Download .xlsx</a>
      </PageHead>
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <span className="dim">Show the last</span>
        <select className="select" name="n" defaultValue={String(n)}>{[3, 6, 12].map((x) => <option key={x} value={x}>{x} months</option>)}</select>
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto dim" style={{ fontSize: 12 }}>{all.length ? `${all.length} month${all.length > 1 ? "s" : ""} with data` : "No salary data yet"}</span>
      </form>
      {latest ? <div className="grid g5" style={{ marginBottom: 16 }}>
        {[["People paid", String(latest.people), monthLabel(latest.month)], ["Net pay", lakh(latest.net), monthLabel(latest.month)], ["CTC", lakh(latest.ctc), "earnings + employer PF / ESIC / LWF + bonus"],
          ["PF + ESIC", lakh(latest.pf + latest.esi), "employee + employer"], ["Unpaid days (X)", String(latest.lop), `of ${latest.payable + latest.lop} days`]].map(([l, v, meta]) => (
          <div key={l} className="card kpi"><div className="lbl">{l}</div><div className="val" style={{ fontSize: 22 }}>{v}</div><div className="meta">{meta}</div></div>))}
      </div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><Icon name="chart" size="sm" /><h3>Monthly cost (all units)</h3></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Month</th><th className="num">People</th><th className="num">Total earning</th><th className="num">Net pay</th><th className="num">PF</th><th className="num">ESIC</th><th className="num">CTC</th><th style={{ width: "30%" }}></th></tr></thead>
          <tbody>{byMonth.map((x) => (
            <tr key={x.month}><td><b>{monthLabel(x.month)}</b></td><td className="num">{x.people}</td><td className="num">{inr(x.totalEarning)}</td><td className="num">{inr(x.net)}</td>
              <td className="num">{inr(x.pf)}</td><td className="num">{inr(x.esi)}</td><td className="num"><b>{inr(x.ctc)}</b></td>
              <td><div style={{ height: 10, borderRadius: 5, background: "var(--brand)", width: `${(x.ctc / maxCtc) * 100}%`, minWidth: 2 }} /></td></tr>))}</tbody>
        </table></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><Icon name="factory" size="sm" /><h3>By unit</h3></div>
        <div className="tbl-wrap"><table className="tbl compact">
          <thead><tr><th>Unit</th>{months.map((mo) => <th key={mo} className="num">{monthLabel(mo)}</th>)}</tr></thead>
          <tbody>{units.map((u) => (
            <tr key={u}><td><b>{u}</b></td>{months.map((mo) => { const r = rows.find((x) => x.unit === u && x.month === mo); return (
              <td key={mo} className="num">{r ? <><div><b>{inr(r.ctc)}</b></div><div className="dim" style={{ fontSize: 11 }}>{r.people} people · net {lakh(r.net)}</div>
                <span className={`badge ${STATUS[r.status] ?? "b-grey"}`} style={{ fontSize: 10.5 }}>{r.status}</span></> : <span className="dim">—</span>}</td>); })}</tr>))}</tbody>
        </table></div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-h"><Icon name="users" size="sm" /><h3>Headcount now</h3><Link className="right" href="/portal/employees">Directory <Icon name="chevR" size="sm" /></Link></div>
          <div className="tbl-wrap"><table className="tbl compact"><thead><tr><th>Unit</th><th className="num">Active</th><th className="num">Left (on record)</th></tr></thead>
            <tbody>{hc.now.map((x) => <tr key={x.unit}><td>{x.unit}</td><td className="num"><b>{x.active}</b></td><td className="num">{x.left}</td></tr>)}
              <tr><td><b>Total</b></td><td className="num"><b>{hc.now.reduce((a, x) => a + x.active, 0)}</b></td><td className="num">{hc.now.reduce((a, x) => a + x.left, 0)}</td></tr></tbody></table></div>
        </div>
        <div className="card">
          <div className="card-h"><Icon name="trend" size="sm" /><h3>Joiners and leavers</h3></div>
          <div className="tbl-wrap"><table className="tbl compact"><thead><tr><th>Month</th><th className="num">Joined</th><th className="num">Left</th><th className="num">Attendance: paid / unpaid days</th></tr></thead>
            <tbody>{hc.flow.map((x) => { const b = byMonth.find((y) => y.month === x.month); return (
              <tr key={x.month}><td>{monthLabel(x.month)}</td><td className="num" style={{ color: x.joined ? "var(--ok)" : undefined }}>{x.joined}</td><td className="num" style={{ color: x.left ? "var(--err)" : undefined }}>{x.left}</td>
                <td className="num">{b ? `${b.payable} / ${b.lop}` : "—"}</td></tr>); })}</tbody></table></div>
        </div>
      </div>
    </>
  );
}
