import ExcelJS from "exceljs";
import { audit, currentUser } from "@/lib/auth";
import { timeCompliance } from "@/lib/attendance";
import { clock } from "@/lib/engine/duty";

export const dynamic = "force-dynamic";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const colName = (n: number) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * Time_Compliance_<UNIT>_<Month>-<YYYY>.xlsx in the layout the client receives (time-compliance format):
 * 3 rows per person (IN, OUT, HRS), dates across, "(+1)" for a next-day OUT, "Missing" for a missing punch,
 * HRS as a live formula. No-punch days are left blank until day codes are added (next build step).
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const q = new URL(req.url).searchParams;
  const unit = q.get("unit") ?? "";
  const [y, m] = (q.get("month") ?? "").split("-").map(Number);
  if (!unit || !y || !m) return new Response("unit and month are required", { status: 400 });
  const tc = await timeCompliance(unit, y, m);
  if (!tc) return new Response("Unknown unit", { status: 404 });
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "VEC Portal";
  const ws = wb.addWorksheet(`Time Compliance ${MON[m - 1]}-${String(y).slice(2)}`, { views: [{ state: "frozen", xSplit: 5, ySplit: 5 }] });
  const firstDay = 6, lastCol = firstDay + tc.days - 1;
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell(1, 1).value = `VIKRAM ENGINEERING CO.  -  ${tc.unit.code}  -  TIME COMPLIANCE (gate IN / OUT time)  -  ${monthName} ${y}`;
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: "FF0A1540" } };
  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell(2, 1).value = 'Each person has 3 rows: IN = first entry at the gate, OUT = last exit for that duty, HRS = time between IN and OUT. Night shift is shown on the day it started; "(+1)" = out next morning. "Missing" = that punch is not recorded.';
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(2).height = 30;

  const head = ws.getRow(4), wd = ws.getRow(5);
  ["Sr.", "Card No.", "Name", "Designation", ""].forEach((v, i) => { head.getCell(i + 1).value = v; });
  for (let d = 1; d <= tc.days; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    head.getCell(firstDay + d - 1).value = `${String(d).padStart(2, "0")}-${MON[m - 1]}`;
    wd.getCell(firstDay + d - 1).value = DOW[dt.getUTCDay()];
    if (dt.getUTCDay() === 0) wd.getCell(firstDay + d - 1).font = { color: { argb: "FFE1121B" }, bold: true };
  }
  for (const r of [head, wd]) for (let c = 1; c <= lastCol; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3F7" } };
    cell.font = { ...(cell.font ?? {}), bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border;
  }

  let r = 6;
  const yyyymm = `${y}-${String(m).padStart(2, "0")}`;
  tc.people.forEach((p, i) => {
    const byDay = new Map(p.duties.map((d) => [d.day, d]));
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = /^\d+$/.test(p.card) ? Number(p.card) : p.card;
    ws.getCell(r, 3).value = p.name + (p.known ? "" : " (not in master)");
    ws.getCell(r, 4).value = p.designation ?? "";
    for (let c = 1; c <= 4; c++) ws.mergeCells(r, c, r + 2, c);
    ["IN", "OUT", "HRS"].forEach((k, j) => { ws.getCell(r + j, 5).value = k; ws.getCell(r + j, 5).font = { color: { argb: "FF7F7F7F" }, size: 9 }; });
    for (let d = 1; d <= tc.days; d++) {
      const c = firstDay + d - 1, L = colName(c);
      const x = byDay.get(d);
      if (!x) { ws.mergeCells(r, c, r + 2, c); continue; }
      ws.getCell(r, c).value = x.inn ? clock(x.inn) : "Missing";
      ws.getCell(r + 1, c).value = clock(x.out, `${yyyymm}-${String(d).padStart(2, "0")}`);
      const result = x.minutes !== null ? x.minutes / 1440 : "-";
      ws.getCell(r + 2, c).value = {
        formula: `IF(OR(${L}${r}="Missing",${L}${r + 1}="Missing"),"-",TIMEVALUE(LEFT(${L}${r + 1},5))+IFERROR(VALUE(MID(${L}${r + 1},FIND("(+",${L}${r + 1})+2,1)),0)-TIMEVALUE(LEFT(${L}${r},5)))`,
        result,
      };
      ws.getCell(r + 2, c).numFmt = "[h]:mm";
      ws.getCell(r + 2, c).font = { bold: true };
      for (const k of [0, 1]) if (ws.getCell(r + k, c).value === "Missing") ws.getCell(r + k, c).font = { color: { argb: "FFC00000" }, bold: true };
    }
    for (let k = 0; k < 3; k++) for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r + k, c);
      cell.border = border;
      cell.alignment = { horizontal: c >= firstDay ? "center" : "left", vertical: "middle", wrapText: c === 3 || c === 4 };
    }
    r += 3;
  });
  ws.getColumn(1).width = 5; ws.getColumn(2).width = 11; ws.getColumn(3).width = 24; ws.getColumn(4).width = 20; ws.getColumn(5).width = 5;
  for (let c = firstDay; c <= lastCol; c++) ws.getColumn(c).width = 10.5;
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:5" };
  wb.calcProperties.fullCalcOnLoad = true;

  const buf = await wb.xlsx.writeBuffer();
  await audit(user.email, "export", "time_compliance", `${unit} ${q.get("month")}`, { people: tc.people.length });
  const name = `Time_Compliance_${unit}_${monthName}-${y}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
