import type { Metadata } from "next";
import Link from "next/link";
import { requireWorker, workerMonths, workerProfile } from "@/lib/worker";
import { Icon } from "@/components/vec/Icon";
import WorkerTop from "./WorkerTop";

export const metadata: Metadata = { title: "My salary" };
export const dynamic = "force-dynamic";

const inr = (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`;
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function WorkerHome() {
  const w = await requireWorker();
  const [p, months] = await Promise.all([workerProfile(w.employeeId), workerMonths(w.employeeId)]);
  const facts: [string, string | null | undefined][] = [
    ["VEC ID", p?.vec_id], ["Card number", w.card], ["Unit", p?.unit ? `${p.unit} — ${p.unit_name}` : null], ["Designation", p?.designation], ["Category", p?.category],
    ["Date of joining", p?.doj ? p.doj.split("-").reverse().join("-") : null], ["UAN", p?.uan], ["ESIC no.", p?.esic_ip],
    ["Bank", p?.bank_name ? `${p.bank_name}${p.account_last4 ? ` · XXXX${p.account_last4}` : ""}` : null],
  ];
  return (
    <div className="worker">
      <WorkerTop name={w.name} />
      <main className="worker-main">
        <h1 style={{ margin: "4px 0 12px" }}>Namaste, {w.name.split(" ")[0]}</h1>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><Icon name="idcard" size="sm" /><h3>My details</h3></div>
          <div className="card-b worker-facts">{facts.map(([k, v]) => <div key={k}><span className="dim">{k}</span><b>{v || "—"}</b></div>)}</div>
        </div>
        <div className="card">
          <div className="card-h"><Icon name="wallet" size="sm" /><h3>My salary</h3></div>
          {months.length ? months.map((x) => (
            <Link key={x.runId} href={`/worker/${x.runId}`} className="worker-month">
              <div><b>{monthName(x.year, x.month)}</b><div className="dim" style={{ fontSize: 12 }}>{x.unit} · {x.payableDays} of {x.days} days paid</div></div>
              <div className="right row" style={{ gap: 8 }}><b style={{ font: "600 17px var(--display)" }}>{inr(x.netAfterPt)}</b><Icon name="chevR" size="sm" /></div>
            </Link>
          )) : <div className="empty">No salary to show yet. A month appears here once the office has finalised it.</div>}
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>Something wrong in your details or salary? Tell the VEC office at your site.</p>
      </main>
    </div>
  );
}
