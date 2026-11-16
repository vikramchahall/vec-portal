import ExcelJS from "exceljs";
import { audit, currentUser } from "@/lib/auth";
import { dataMonths, headcount, salaryByUnitMonth } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Reports_<date>.xlsx: salary by unit and month, headcount, joiners and leavers. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const n = Math.min(12, Math.max(1, Number(new URL(req.url).searchParams.get("n")) || 6));
  const months = (await dataMonths()).all.slice(0, n);
  const [rows, hc] = await Promise.all([salaryByUnitMonth(months), headcount(months)]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "VEC Portal";
  const sheet = (name: string, head: string[], data: (string | number)[][], widths: number[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(head).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3F7" } };
    for (const d of data) ws.addRow(d);
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.eachRow((r, i) => { if (i > 1) r.eachCell((c) => { if (typeof c.value === "number") c.numFmt = "#,##0"; }); });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } };
  };
  sheet("Salary by unit", ["Month", "Unit", "Status", "People", "Payable days", "Unpaid days (X)", "Total earning", "Monthly bonus", "Net pay", "PF employee", "PF employer", "ESIC employee", "ESIC employer", "CTC", "CTC for billing"],
    rows.map((r) => [r.month, r.unit, r.status, r.people, r.payableDays, r.lop, r.totalEarning, r.bonus, r.net, r.pfEE, r.pfER, r.esiEE, r.esiER, r.ctc, r.ctcBilling]),
    [10, 10, 10, 8, 10, 10, 14, 12, 14, 12, 12, 12, 12, 14, 14]);
  sheet("Headcount", ["Unit", "Active", "Left (on record)"], hc.now.map((x) => [x.unit, x.active, x.left]), [12, 10, 16]);
  sheet("Joiners & leavers", ["Month", "Joined", "Left"], hc.flow.map((x) => [x.month, x.joined, x.left]), [10, 10, 10]);
  const buf = await wb.xlsx.writeBuffer();
  await audit(user.email, "export", "reports", null, { months });
  return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="VEC_Reports_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}
