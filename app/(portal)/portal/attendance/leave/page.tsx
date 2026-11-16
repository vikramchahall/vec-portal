import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { monthAttendance } from "@/lib/codes";
import { unitList } from "@/lib/employees";
import { DEFAULT_LEAVE } from "@/lib/engine/codes";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import OpeningButton from "./OpeningButton";

export const dynamic = "force-dynamic";
const f2 = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2));
const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** L and CL balances per person: brought forward, earned / credited, used to cover X days, closing (= next month's B/F). */
export default async function Leave({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const punchUnits = units.filter((u) => u.mode === "punch");
  const unit = punchUnits.find((u) => u.code === sp.unit)?.code ?? punchUnits[0]?.code;
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const ma = unit ? await monthAttendance(unit, y, m) : null;
  const q = (sp.q ?? "").trim().toUpperCase();
  const people = (ma?.persons ?? []).filter((p) => p.known && p.b && (!q || p.name.includes(q) || p.card.includes(q)));
  const sum = (f: (b: NonNullable<(typeof people)[number]["b"]>) => number) => people.reduce((s, p) => s + f(p.b!), 0);
  const noOpening = people.filter((p) => !p.hasOpening).length;
  const editable = user.role === "owner" && ma?.run.status === "draft";

  return (
    <>
      <Crumbs items={[["Attendance"], ["Leave Management"]]} />
      <PageHead title="Leave management" sub={`Leave (L): ${DEFAULT_LEAVE.lPerWorkedDay} earned per P / HP day. CL: extra hours × ${DEFAULT_LEAVE.excessFactor} ÷ ${DEFAULT_LEAVE.clHoursPerDay} from C-Off. X days are covered by whole days of L first, then CL. Closing = B/F + earned − used, and opens next month.`}>
        <Link className="btn" href={`/portal/attendance/coff?unit=${unit}&month=${month}`}><Icon name="clock" size="sm" />C-Off hours</Link>
        <Link className="btn" href={`/portal/attendance/review?unit=${unit}&month=${month}`}><Icon name="calendar" size="sm" />Day codes</Link>
      </PageHead>
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="unit" defaultValue={unit}>{punchUnits.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}</select>
        <select className="select" name="month" defaultValue={month}>{[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}</select>
        <label className="search-in"><Icon name="search" size="sm" /><input name="q" defaultValue={sp.q} placeholder="Name or card" /></label>
        <button className="btn" type="submit">Show</button>
        {ma ? <span className="ml-auto badge b-grey">Status: {ma.run.status}</span> : null}
      </form>
      {!ma ? null : <>
        <div className="grid g5" style={{ marginBottom: 16 }}>
          {[["People", String(people.length)], ["L used / earned", `${f2(sum((b) => b.used.l))} / ${f2(sum((b) => b.credit.l))}`], ["CL used / credited", `${f2(sum((b) => b.used.cl))} / ${f2(sum((b) => b.credit.cl))}`],
            ["X days left unpaid", String(sum((b) => b.counts.X))], ["No opening balance", String(noOpening)]].map(([l, v]) => (
            <div key={l} className="card kpi"><div className="lbl">{l}</div><div className="val" style={{ fontSize: 22, color: l === "No opening balance" && noOpening ? "var(--warn)" : undefined }}>{v}</div></div>))}
        </div>
        {noOpening ? <div className="alert warn" style={{ marginBottom: 12 }}><Icon name="alert" size="sm" /><div>{noOpening} without an opening balance for {monthLabel(month)} — treated as 0. Import the previous month&apos;s file, lock the previous month in the portal, or enter it with the pencil.</div></div> : null}
        <div className="card"><div className="tbl-wrap" style={{ maxHeight: 640 }}><table className="tbl compact">
          <thead>
            <tr><th className="grp" colSpan={2} /><th className="grp" colSpan={4}>Leave (L)</th><th className="grp" colSpan={4}>CL / C-Off</th><th className="grp" colSpan={3} /></tr>
            <tr><th>Card</th><th>Name</th><th className="num">B/F</th><th className="num">Earned</th><th className="num">Used</th><th className="num">Closing</th>
              <th className="num">B/F</th><th className="num">Credited</th><th className="num">Used</th><th className="num">Closing</th><th className="num">X days</th><th>Opening from</th><th></th></tr>
          </thead>
          <tbody>{people.map((p) => { const b = p.b!; return (
            <tr key={p.card}>
              <td className="mono">{p.card}</td><td><Link href={`/portal/employees/${p.employeeId}`}>{p.name}</Link></td>
              <td className="num">{f2(b.bf.l)}</td><td className="num">{f2(b.credit.l)}</td><td className="num">{f2(b.used.l)}</td><td className="num"><b>{f2(b.close.l)}</b></td>
              <td className="num">{f2(b.bf.cl)}</td><td className="num">{f2(b.credit.cl)}</td><td className="num">{f2(b.used.cl)}</td><td className="num"><b>{f2(b.close.cl)}</b></td>
              <td className="num" style={{ color: b.counts.X ? "var(--err)" : undefined }}>{b.counts.X}</td>
              <td>{p.hasOpening ? <span className="dim" style={{ fontSize: 12 }}>on record</span> : <span className="badge b-amber">none</span>}</td>
              <td>{user.role === "owner" ? <OpeningButton unit={unit!} year={y} month={m} employeeId={p.employeeId!} name={p.name} cl={b.bf.cl} l={b.bf.l} disabled={!editable} /> : null}</td>
            </tr>); })}</tbody>
        </table></div></div>
      </>}
    </>
  );
}
