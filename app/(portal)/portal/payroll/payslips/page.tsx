import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { monthSalary } from "@/lib/payroll";
import { Slip } from "@/components/vec/Slip";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import PrintButton from "./PrintButton";

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
            {pg.map((r, k) => <Slip key={r.p.card} r={r} unit={{ code: unit, name: ms!.unit.name, workOrders: ms!.unit.workOrders }} monthName={monthName} days={ms!.days} cut={k === 0 && pg.length > 1} />)}
          </div>
        ))}
      </div>
    </>
  );
}
