import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorker, workerMonth } from "@/lib/worker";
import { Icon } from "@/components/vec/Icon";
import { Slip } from "@/components/vec/Slip";
import PrintButton from "@/app/(portal)/portal/payroll/payslips/PrintButton";
import WorkerTop from "../WorkerTop";

export const metadata: Metadata = { title: "My salary" };
export const dynamic = "force-dynamic";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CODE_NAMES: Record<string, string> = { P: "Present", HP: "Holiday worked", H: "Holiday", WO: "Weekly off", L: "Leave", CL: "Casual leave", X: "Absent (unpaid)", OD: "On duty" };
const fix = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

export default async function WorkerMonthPage({ params }: { params: Promise<{ run: string }> }) {
  const w = await requireWorker();
  const { run } = await params;
  const m = /^\d+$/.test(run) ? await workerMonth(w.employeeId, Number(run)) : null;
  if (!m) notFound();
  const { row, days, year, month } = m;
  const b = row.p.b!, l = row.line!;
  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (
    <div className="worker">
      <WorkerTop name={w.name} />
      <main className="worker-main">
        <div className="row no-print" style={{ margin: "4px 0 12px", gap: 8 }}>
          <Link className="btn sm" href="/worker"><Icon name="chevL" size="sm" />Back</Link>
          <h1 style={{ margin: 0 }}>{title}</h1>
        </div>

        <div className="card no-print" style={{ marginBottom: 16 }}><div className="card-b worker-tiles">
          {[["Net pay", `₹${Math.round(l.netAfterPt).toLocaleString("en-IN")}`], ["Days paid", `${l.payableDays} of ${days}`], ["Unpaid (X)", String(l.lop)], ["PF this month", `₹${l.pf.toLocaleString("en-IN")}`]].map(([k, v]) => (
            <div key={k}><span className="dim">{k}</span><b>{v}</b></div>))}
        </div></div>

        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-h"><Icon name="calendar" size="sm" /><h3>Attendance</h3></div>
          <div className="card-b">
            <div className="worker-cal">
              {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
              {b.final.slice(0, days).map((c, i) => (
                <div key={i} className="day"><span className="dim">{i + 1}</span><span className={`code ${c}`}>{c || "—"}</span></div>
              ))}
            </div>
            <div className="row wrap mt16" style={{ gap: 12, fontSize: 12 }}>
              {(["P", "HP", "H", "WO", "L", "CL", "X"] as const).filter((c) => b.counts[c]).map((c) => <span key={c}><span className={`code ${c}`}>{c}</span> {CODE_NAMES[c]}: <b>{b.counts[c]}</b></span>)}
            </div>
          </div>
        </div>

        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-h"><Icon name="sun" size="sm" /><h3>Leave balance</h3></div>
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th></th><th className="num" title="Brought forward from last month">B/F</th><th className="num">Earned</th><th className="num">Used</th><th className="num">Balance</th></tr></thead>
            <tbody>
              <tr><td>Leave (L)</td><td className="num">{fix(b.bf.l)}</td><td className="num">{fix(b.credit.l)}</td><td className="num">{fix(b.used.l)}</td><td className="num"><b>{fix(b.close.l)}</b></td></tr>
              <tr><td>Casual leave (CL)</td><td className="num">{fix(b.bf.cl)}</td><td className="num">{fix(b.credit.cl)}</td><td className="num">{fix(b.used.cl)}</td><td className="num"><b>{fix(b.close.cl)}</b></td></tr>
            </tbody>
          </table></div>
          <div className="card-b dim" style={{ fontSize: 12 }}>B/F = brought forward from last month. Absent days are covered by your Leave first, then Casual leave. You earn 0.064 Leave for every day worked; extra hours on duty add to Casual leave (8 hours = 1 day).</div>
        </div>

        <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 8 }}><h3 style={{ margin: 0 }}>Payslip</h3><PrintButton /></div>
        <div className="slips worker-slip"><div className="slip-page"><Slip r={row} unit={m.unit} monthName={title} days={days} /></div></div>
      </main>
    </div>
  );
}
