import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { monthAttendance } from "@/lib/codes";
import { unitList } from "@/lib/employees";
import { DEFAULT_LEAVE } from "@/lib/engine/codes";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";

export const dynamic = "force-dynamic";
const f2 = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2));
const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** The C-Off sheet: extra (+) and short (−) hours on each worked day, and the CL they credit. */
export default async function COff({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const punchUnits = units.filter((u) => u.mode === "punch");
  const unit = punchUnits.find((u) => u.code === sp.unit)?.code ?? punchUnits[0]?.code;
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const ma = unit ? await monthAttendance(unit, y, m) : null;
  const days = ma?.days ?? 31;
  const people = (ma?.persons ?? []).filter((p) => p.known && p.b);
  // the hours that count: worked days (P / HP) whose punches are not marked "ignore"
  const hoursOf = (p: (typeof people)[number]) => Array.from({ length: days }, (_, i) => {
    const raw = p.raw[i], dut = p.duties.find((x) => x.day === i + 1);
    return dut && (raw === "P" || raw === "HP") && p.overrides.get(i + 1)?.code !== "NOPUNCH" ? dut.coff : 0;
  });
  const total = people.reduce((a, p) => ({ ex: a.ex + p.b!.coff.excess, le: a.le + p.b!.coff.less, cl: a.cl + p.b!.coff.totalCl }), { ex: 0, le: 0, cl: 0 });

  return (
    <>
      <Crumbs items={[["Attendance"], ["C-Off Management"]]} />
      <PageHead title="C-Off management" sub={`Extra and short hours on worked days, from the punches (half-hour steps, as the C-Off sheet). CL hours = extra × ${DEFAULT_LEAVE.excessFactor} + short; ${DEFAULT_LEAVE.clHoursPerDay} CL hours = 1 day of CL.`}>
        <Link className="btn" href={`/portal/attendance/leave?unit=${unit}&month=${month}`}><Icon name="sun" size="sm" />Leave balances</Link>
        <Link className="btn" href={`/portal/attendance/time-compliance?unit=${unit}&month=${month}`}><Icon name="clock" size="sm" />Time Compliance</Link>
      </PageHead>
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="unit" defaultValue={unit}>{punchUnits.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}</select>
        <select className="select" name="month" defaultValue={month}>{[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}</select>
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto dim" style={{ fontSize: 12.5 }}>Extra <b>{f2(total.ex)} h</b> · short <b>{f2(total.le)} h</b> · CL credited <b>{f2(total.cl)} days</b></span>
      </form>
      {!ma ? null : (
        <div className="card"><div className="tbl-wrap" style={{ maxHeight: 680 }}><table className="tbl compact ws">
          <thead><tr><th className="stick">Card</th><th className="stick2" style={{ minWidth: 170 }}>Name</th>
            {Array.from({ length: days }, (_, i) => <th key={i} className="num" style={{ minWidth: 30 }}>{i + 1}</th>)}
            <th className="num">Extra</th><th className="num">Short</th><th className="num">CL hours</th><th className="num">CL days</th></tr></thead>
          <tbody>{people.map((p) => { const h = hoursOf(p), c = p.b!.coff; return (
            <tr key={p.card}><td className="stick mono">{p.card}</td><td className="stick2">{p.name}</td>
              {h.map((v, i) => <td key={i} className="num" style={{ color: v > 0 ? "var(--ok)" : v < 0 ? "var(--err)" : "var(--text-3)", fontSize: 11.5 }}>{v ? (v > 0 ? `+${f2(v)}` : f2(v)) : "·"}</td>)}
              <td className="num">{f2(c.excess)}</td><td className="num">{f2(c.less)}</td><td className="num">{f2(c.clHours)}</td><td className="num"><b>{f2(c.totalCl)}</b></td></tr>); })}</tbody>
        </table></div></div>
      )}
    </>
  );
}
