import { requireUser } from "@/lib/auth";
import { billingFor } from "@/lib/billing";
import { dataMonths } from "@/lib/reports";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, inr } from "@/components/vec/ui";
import { BillButton, RateButton } from "./FinanceClient";

export const dynamic = "force-dynamic";
const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const short = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const STATUS: Record<string, string> = { draft: "b-grey", approved: "b-blue", locked: "b-lock" };
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const signed = (x: number) => <span style={{ color: x < 0 ? "var(--err)" : x > 0 ? "var(--ok)" : undefined }}>{x > 0 ? "+" : x < 0 ? "−" : ""}{inr(Math.abs(x))}</span>;

export default async function Finance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const owner = user.role === "owner";
  const sp = await searchParams;
  const { all } = await dataMonths();
  const month = sp.month && all.includes(sp.month) ? sp.month : all[0];
  const trendMonths = all.slice(0, 6);
  const rows = month ? await billingFor([...new Set([month, ...trendMonths])]) : [];
  const now = rows.filter((r) => r.month === month);
  const [y, m] = (month ?? "2000-01").split("-").map(Number);
  const sum = (rs: typeof rows, f: (r: (typeof rows)[number]) => number) => rs.reduce((a, r) => a + f(r), 0);
  const cost = sum(now, (r) => r.ctcBilling), exp = sum(now, (r) => r.expectedEarning), expBill = sum(now, (r) => r.expectedBill);
  const billed = now.filter((r) => r.bill), passed = sum(billed, (r) => r.bill!.amount), actual = sum(billed, (r) => r.actualEarning!);
  const trend = trendMonths.map((mo) => { const rs = rows.filter((r) => r.month === mo), b = rs.filter((r) => r.bill); return { mo, cost: sum(rs, (r) => r.ctcBilling), exp: sum(rs, (r) => r.expectedEarning), units: rs.length, billed: b.length, actual: b.length ? sum(b, (r) => r.actualEarning!) : null }; });
  const maxExp = Math.max(1, ...trend.map((t) => Math.max(t.exp, t.actual ?? 0)));

  return (
    <>
      <Crumbs items={[["Finance"], ["Billing & Profitability"]]} />
      <PageHead title="Billing & profitability" sub="Cost = each unit's CTC for billing from the Working Salary. VEC's expected earning = ₹ per employee (HMEL) or % of the cost (STP, HZL). Enter the bill the client passed to see the actual earning." />
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="month" defaultValue={month}>{all.map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}</select>
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto dim" style={{ fontSize: 12 }}>{billed.length} of {now.length} units have the bill passed</span>
      </form>
      {!month ? <div className="card"><div className="empty">No salary data yet.</div></div> : <>
        <div className="grid g5" style={{ marginBottom: 16 }}>
          {[["Salary cost", inr(cost), "CTC for billing"], ["Expected bill", inr(expBill), "cost + VEC earning"], ["Expected earning", inr(exp), pct(exp, expBill) + " of the bill"],
            ["Bills passed", billed.length ? inr(passed) : "—", `${billed.length} unit${billed.length === 1 ? "" : "s"}`], ["Actual earning", billed.length ? inr(actual) : "—", billed.length ? `vs expected ${inr(sum(billed, (r) => r.expectedEarning))}` : "enter the bills passed"]].map(([l, v, meta]) => (
            <div key={l} className="card kpi"><div className="lbl">{l}</div><div className="val" style={{ fontSize: 21 }}>{v}</div><div className="meta">{meta}</div></div>))}
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><Icon name="rupee" size="sm" /><h3>{monthLabel(month)} by unit</h3></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Unit</th><th className="num">People</th><th className="num">Salary cost</th><th>VEC rate</th><th className="num">Expected earning</th><th className="num">Expected bill</th>
              <th className="num">Bill passed</th><th className="num">Actual earning</th><th className="num">vs expected</th><th className="num">Margin</th></tr></thead>
            <tbody>{now.map((r) => (
              <tr key={r.unit}>
                <td><b>{r.unit}</b> <span className={`badge ${STATUS[r.status] ?? "b-grey"}`} style={{ fontSize: 10.5 }}>{r.status}</span></td>
                <td className="num">{r.people}</td><td className="num">{inr(r.ctcBilling)}</td>
                <td><span className="row" style={{ gap: 4 }}>{r.model === "percent" ? `${r.rate}% of cost` : `${inr(r.rate)} / person`}{owner ? <RateButton unit={r.unit} model={r.model} rate={r.rate} /> : null}</span></td>
                <td className="num">{inr(r.expectedEarning)}</td><td className="num">{inr(r.expectedBill)}</td>
                <td className="num"><span className="row" style={{ gap: 4, justifyContent: "flex-end" }}>{r.bill ? <span title={[r.bill.billNo && `Bill ${r.bill.billNo}`, r.bill.passedOn && `passed ${r.bill.passedOn}`, r.bill.note].filter(Boolean).join(" · ")}>{inr(r.bill.amount)}</span> : <span className="dim">—</span>}
                  {owner ? <BillButton unit={r.unit} year={y} month={m} expected={r.expectedBill} bill={r.bill ? { amount: String(r.bill.amount), amountN: r.bill.amount, billNo: r.bill.billNo ?? "", billDate: r.bill.billDate ?? "", passedOn: r.bill.passedOn ?? "", note: r.bill.note ?? "" } : null} /> : null}</span></td>
                <td className="num">{r.actualEarning === null ? <span className="dim">—</span> : <b>{inr(r.actualEarning)}</b>}</td>
                <td className="num">{r.difference === null ? <span className="dim">—</span> : signed(r.difference)}</td>
                <td className="num">{r.bill ? pct(r.actualEarning!, r.bill.amount) : <span className="dim">{pct(r.expectedEarning, r.expectedBill)}</span>}</td>
              </tr>))}</tbody>
            <tfoot><tr><td><b>Total</b></td><td className="num">{sum(now, (r) => r.people)}</td><td className="num">{inr(cost)}</td><td /><td className="num">{inr(exp)}</td><td className="num">{inr(expBill)}</td>
              <td className="num">{billed.length ? inr(passed) : "—"}</td><td className="num">{billed.length ? inr(actual) : "—"}</td><td className="num">{billed.length ? signed(actual - sum(billed, (r) => r.expectedEarning)) : "—"}</td><td className="num">{billed.length ? pct(actual, passed) : ""}</td></tr></tfoot>
          </table></div>
        </div>
        <div className="card">
          <div className="card-h"><Icon name="trend" size="sm" /><h3>Earning trend</h3><span className="right dim" style={{ fontSize: 12 }}>bar = expected · green = actual (bills passed)</span></div>
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th>Month</th><th className="num">Salary cost</th><th className="num">Expected earning</th><th className="num">Actual earning</th><th style={{ width: "35%" }}></th></tr></thead>
            <tbody>{trend.map((t) => (
              <tr key={t.mo}><td>{short(t.mo)}</td><td className="num">{inr(t.cost)}</td><td className="num">{inr(t.exp)}</td>
                <td className="num">{t.actual === null ? <span className="dim">—</span> : <>{inr(t.actual)}{t.billed < t.units ? <span className="dim" style={{ fontSize: 11 }}> ({t.billed}/{t.units} units)</span> : null}</>}</td>
                <td><div style={{ height: 8, borderRadius: 4, background: "var(--brand)", width: `${(t.exp / maxExp) * 100}%`, minWidth: 2 }} />
                  {t.actual !== null ? <div style={{ height: 8, borderRadius: 4, background: "var(--ok)", width: `${(Math.max(0, t.actual) / maxExp) * 100}%`, minWidth: 2, marginTop: 3 }} /> : null}</td></tr>))}</tbody>
          </table></div>
        </div>
      </>}
    </>
  );
}
