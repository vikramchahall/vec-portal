import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { unitList } from "@/lib/employees";
import { monthSalary } from "@/lib/payroll";
import { approvalChecks } from "@/lib/lock";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, inr } from "@/components/vec/ui";
import { lockPhrase } from "./actions";
import RunActions from "./RunActions";

const BADGE: Record<string, [string, string, string]> = {
  draft: ["b-grey", "edit", "Draft"], approved: ["b-green", "checkCircle", "Approved"], locked: ["b-lock", "lock", "Locked"],
};

export default async function Approval({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const months = await punchMonths();
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const units = (await unitList()).filter((u) => u.mode === "punch");
  const all = await Promise.all(units.map(async (u) => ({ u, ms: await monthSalary(u.code, y, m) })));
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const owner = user.role === "owner";

  return (
    <>
      <Crumbs items={[["Payroll"], ["Approval & Lock"]]} />
      <PageHead title={`Approval & lock — ${monthName}`} sub="Approve each unit when its checks pass; approval stops changes but can be reopened. Locking is final: the month is frozen and its closing leave balances open next month." />
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="month" defaultValue={month}>
          {[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
        {!owner ? <span className="ml-auto badge b-amber">Only the owner can approve or lock</span> : null}
      </form>
      <div className="grid g2">
        {await Promise.all(all.map(async ({ u, ms }) => {
          if (!ms) return null;
          const status = ms.run.status;
          const checks = approvalChecks(ms);
          const ready = checks.every((c) => c.ok);
          const [cls, icon, label] = BADGE[status] ?? BADGE.draft;
          return (
            <div key={u.code} className={`zone ${status === "approved" ? "lockzone" : ""}`}>
              <div className="zh">
                <Icon name={status === "locked" ? "lock" : "shield"} size="lg" />
                <div><b>{u.code}</b><div style={{ fontSize: 12.5, opacity: 0.8 }}>{ms.rows.length} employees · net after PT {inr(ms.totals.netAfterPt)} · CTC {inr(ms.totals.ctcBilling)}</div></div>
                <span className={`badge ${cls} ml-auto`}><Icon name={icon} />{label}</span>
              </div>
              {status === "locked" ? (
                <div className="card-b" style={{ fontSize: 13 }}>
                  Locked {ms.run.lockedAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} by {ms.run.lockedBy}. Closing L / CL balances were carried to next month.
                  <div className="row mt8"><Link className="btn sm" href={`/portal/payroll/working-salary?unit=${u.code}&month=${month}`}>Working Salary</Link><Link className="btn sm" href={`/portal/payroll/payslips?unit=${u.code}&month=${month}`}>Payslips</Link></div>
                </div>
              ) : (
                <>
                  <ul className="check-list">{checks.map((c) => <li key={c.text}><Icon name={c.ok ? "checkCircle" : "xCircle"} size="sm" className={c.ok ? "ok" : "no"} />{c.text}</li>)}</ul>
                  <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
                    {status === "approved"
                      ? <div className="dim" style={{ fontSize: 12.5, marginBottom: 8 }}>Approved {ms.run.approvedAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} by {ms.run.approvedBy}</div>
                      : !ready ? <div className="row" style={{ fontSize: 12.5, marginBottom: 8 }}><Link href={`/portal/attendance/review?unit=${u.code}&month=${month}`}>Open Attendance Review</Link><span className="dim">to clear the items above</span></div> : null}
                    <RunActions unit={u.code} year={y} month={m} status={status} ready={ready} owner={owner} phrase={await lockPhrase(u.code, y, m)}
                      summary={`${ms.rows.length} employees · net after PT ${inr(ms.totals.netAfterPt)}`} />
                  </div>
                </>
              )}
            </div>
          );
        }))}
      </div>
    </>
  );
}
