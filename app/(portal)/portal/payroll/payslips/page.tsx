import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { monthSalary } from "@/lib/payroll";
import { rupeesInWords } from "@/lib/words";
import { Mark } from "@/components/vec/Icon";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import PrintButton from "./PrintButton";

const n = (x: number) => Math.round(x).toLocaleString("en-IN");

/** Salary slips, 2 per A4 (cut along the dashed line) — the Slips sheet of the Working Salary workbook. */
export default async function Payslips({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string; card?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const unit = sp.unit ?? "", month = sp.month ?? "";
  const [y, m] = month.split("-").map(Number);
  const ms = unit && y && m ? await monthSalary(unit, y, m) : null;
  const rows = (ms?.rows ?? []).filter((r) => r.line && r.line.payableDays > 0 && (!sp.card || r.p.card === sp.card));
  const monthName = y ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const pages: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 2) pages.push(rows.slice(i, i + 2));

  return (
    <>
      <div className="no-print">
        <Crumbs items={[["Payroll"], ["Working Salary", `/portal/payroll/working-salary?unit=${unit}&month=${month}`], ["Payslips"]]} />
        <PageHead title={`Payslips · ${unit} · ${monthName}`} sub={`${rows.length} slips, 2 per A4 page. Print, or choose "Save as PDF" in the print window.`}>
          <Link className="btn" href={`/portal/payroll/working-salary?unit=${unit}&month=${month}`}><Icon name="chevL" size="sm" />Back</Link>
          <PrintButton />
        </PageHead>
      </div>
      {!ms ? <div className="card"><div className="empty">Choose a unit and month from the Working Salary screen.</div></div> : null}
      <div className="slips">
        {pages.map((pg, i) => (
          <div key={i} className="slip-page">
            {pg.map((r, k) => {
              const l = r.line!;
              const earn: [string, number][] = [["Basic + DA", l.earnedBasicDa + l.earnedDa], ["HRA", l.earnedHra], ["Special allowance", l.earnedSpecial], ["Conveyance", l.earnedConveyance], ["Holiday pay (HP)", l.hpAmount + l.otAmount], ["Monthly bonus", l.bonus]];
              const ded: [string, number][] = [["Provident Fund", l.pf], ["ESIC", l.esi], ["Labour Welfare Fund", l.lwf], ["Professional Tax", l.pt], ["Hold", l.hold]];
              const te = earn.reduce((s, [, v]) => s + v, 0), td = ded.reduce((s, [, v]) => s + v, 0);
              return (
                <div key={r.p.card} className={`slip ${k === 0 && pg.length > 1 ? "slip-cut" : ""}`}>
                  <div className="sh"><Mark size={46} />
                    <div><div style={{ font: "700 17px var(--display)", color: "#0F3CE8" }}>VIKRAM ENGINEERING CO.</div>
                      <div style={{ fontSize: 11, color: "#555" }}>Sub-contractor of Aquatech Systems Asia Pvt. Ltd. · {ms!.unit.name} · HMEL Refinery, Bathinda</div></div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}><b>Salary Slip</b><div style={{ fontSize: 11 }}>{monthName} · Form XIX</div></div></div>
                  <table><tbody>
                    <tr><th style={{ width: "18%" }}>Employee code</th><td>{r.p.card}</td><th style={{ width: "18%" }}>Name</th><td>{r.p.name}</td></tr>
                    <tr><th>Designation</th><td>{r.p.designation ?? ""}</td><th>Unit</th><td>{unit} ({ms!.unit.workOrders.join(", ") || "HMEL"})</td></tr>
                    <tr><th>UAN</th><td>{r.uan ?? "—"}</td><th>ESIC no.</th><td>{r.esicIp ?? "—"}</td></tr>
                    <tr><th>Bank / A/c</th><td>{r.bank.name ?? "—"}{r.bank.last4 ? ` · XXXX${r.bank.last4}` : ""}</td><th>IFSC</th><td>{r.bank.ifsc ?? "—"}</td></tr>
                    <tr><th>Days payable</th><td>{l.payableDays} of {ms!.days}</td><th>LOP days</th><td>{l.lop}</td></tr>
                  </tbody></table>
                  <table style={{ marginTop: -1 }}><tbody>
                    <tr><th>Earnings</th><th style={{ textAlign: "right" }}>₹</th><th>Deductions</th><th style={{ textAlign: "right" }}>₹</th></tr>
                    {earn.map(([lbl, v], j) => (
                      <tr key={lbl}><td>{lbl}</td><td style={{ textAlign: "right" }}>{n(v)}</td><td>{ded[j]?.[0] ?? ""}</td><td style={{ textAlign: "right" }}>{ded[j] ? n(ded[j][1]) : ""}</td></tr>))}
                    <tr><th>Total earnings</th><th style={{ textAlign: "right" }}>{n(te)}</th><th>Total deductions</th><th style={{ textAlign: "right" }}>{n(td)}</th></tr>
                    <tr><th colSpan={2} style={{ background: "#0A1540", color: "#fff" }}>Net pay</th><th colSpan={2} style={{ background: "#0A1540", color: "#fff", textAlign: "right", fontSize: 14 }}>₹{n(l.netAfterPt)}</th></tr>
                    <tr><td colSpan={4} style={{ fontSize: 11.5 }}>Rupees {rupeesInWords(l.netAfterPt)} Only</td></tr>
                  </tbody></table>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px 8px", fontSize: 10.5, color: "#555" }}><span>Computer-generated slip · VEC Portal</span><span>Authorised signatory</span></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
