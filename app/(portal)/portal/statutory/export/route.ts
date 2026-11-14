import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { audit, currentUser } from "@/lib/auth";
import { ecrText, statutoryMonth, EPS_CEILING, type StatRow } from "@/lib/statutory";

export const dynamic = "force-dynamic";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ?group=ETP&month=2026-10&kind=combined|ecr|esic */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const q = new URL(req.url).searchParams;
  const group = q.get("group") ?? "", kind = q.get("kind") ?? "combined";
  const [y, m] = (q.get("month") ?? "").split("-").map(Number);
  if (!group || !y || !m) return new Response("group and month are required", { status: 400 });
  const s = await statutoryMonth(group, y, m);
  if (!s) return new Response("Unknown group", { status: 404 });
  const tag = `${MON[m - 1]}-${y}`;
  const send = (body: BodyInit, type: string, name: string) => new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  await audit(user.email, "export", `statutory_${kind}`, `${group} ${q.get("month")}`, { rows: s.rows.length, ...s.totals });

  if (kind === "ecr") return send(ecrText(s), "text/plain; charset=utf-8", `ECR_${group}_${tag}.txt`);

  if (kind === "esic") {
    // ESIC portal "Monthly Contribution" upload (Excel 97-2003)
    const head = ["IP Number", "IP Name", "No of Days for which wages paid/payable during the month", "Total Monthly Wages",
      "Reason Code for Zero workings days(numeric only; provide 0 for all other reasons- Click on the link for reference)", "Last Working Day( Format DD/MM/YYYY or DD-MM-YYYY)"];
    const data = s.rows.filter((r) => r.esi && r.esicIp).map((r) => [r.esicIp, r.name, r.days, r.esicWages, 0, ""]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...data]), "Sheet1");
    return send(XLSX.write(wb, { type: "buffer", bookType: "xls" }), "application/vnd.ms-excel", `ESIC_MC_${group}_${tag}.xls`);
  }

  // Combined ESIC & EPFO statement (the Sep-26 workbook layout, one column per figure)
  const wb = new ExcelJS.Workbook();
  wb.creator = "VEC Portal";
  const ws = wb.addWorksheet("Combined ESIC-EPFO", { views: [{ state: "frozen", xSplit: 4, ySplit: 3 }] });
  const cols: [string, keyof StatRow | null, number][] = [
    ["Sl. No", null, 6], ["ID", "card", 11], ["Register No.", "regNo", 9], ["Name", "name", 26], ["Designation", "designation", 20], ["Category", "category", 12],
    ["UAN", "uan", 14], ["ESIC IP", "esicIp", 12], ["Days Payable", "days", 8], ["NCP Days (LOP)", "lop", 8], ["Basic + DA", "basicDa", 10], ["Gross Salary", "gross", 10],
    ["Total Earning", "totalEarning", 11], ["EPF Wages", "epfWages", 10], ["EPS Wages", "epsWages", 10], ["EPF Employee 12%", "pfEE", 10],
    ["EPF Employer 13%", "pfER", 10], ["EPS 8.33%", "eps", 9], ["EPF-EPS Diff", "epfEpsDiff", 9], ["ESIC Wages", "esicWages", 10],
    ["ESIC Employee 0.75%", "esiEE", 10], ["ESIC Employer 3.25%", "esiER", 10], ["Total EPF (EE+ER)", null, 11], ["Total ESIC (EE+ER)", null, 11],
  ];
  const L = (i: number) => ws.getColumn(i + 1).letter;
  const ci = (k: keyof StatRow) => cols.findIndex((c) => c[1] === k);
  const blue = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDCE3F7" } };
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  ws.getCell("A1").value = `ESIC & EPFO - Combined | ${group} | ${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A2").value = `EPF wages = gross − HRA, ceiling Rs 25,000; EPS wages ceiling Rs ${EPS_CEILING.toLocaleString("en-IN")}. ESIC wages = Total Earning + Monthly Bonus. Units: ${s.units.map((u) => `${u.code} (${u.status})`).join(", ")}. Values from the portal's Working Salary.`;
  const hr = ws.getRow(3);
  cols.forEach(([h, , w], i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true }; c.fill = blue; c.alignment = { wrapText: true, horizontal: "center", vertical: "middle" }; c.border = { top: thin, bottom: thin, left: thin, right: thin }; ws.getColumn(i + 1).width = w; });
  hr.height = 32;
  const money = cols.map((c, i) => (i >= ci("basicDa") ? i : -1)).filter((i) => i >= 0);
  const subtotalRows: { unit: string; row: number }[] = [];
  let r = 4;
  for (const u of s.units) {
    ws.getCell(`A${r}`).value = `${u.code} — ${u.name}`;
    ws.getRow(r).font = { bold: true };
    r++;
    const first = r;
    s.rows.filter((x) => x.unit === u.code).forEach((x, i) => {
      const row = ws.getRow(r);
      cols.forEach(([, k], j) => { if (k) row.getCell(j + 1).value = x[k] === "" ? null : (/^\d{1,15}$/.test(String(x[k] ?? "")) && (k === "card" || k === "regNo") ? Number(x[k]) : x[k]) as ExcelJS.CellValue; });
      row.getCell(1).value = i + 1;
      row.getCell(ci("pfER") + 7).value = { formula: `${L(ci("pfEE"))}${r}+${L(ci("pfER"))}${r}` };
      row.getCell(ci("pfER") + 8).value = { formula: `${L(ci("esiEE"))}${r}+${L(ci("esiER"))}${r}` };
      r++;
    });
    const last = r - 1;
    const tr = ws.getRow(r);
    tr.getCell(4).value = `${u.code} total`;
    for (const j of money) tr.getCell(j + 1).value = last >= first ? { formula: `SUM(${L(j)}${first}:${L(j)}${last})` } : 0;
    tr.font = { bold: true };
    tr.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }; });
    subtotalRows.push({ unit: u.code, row: r });
    r += 2;
  }
  const gt = ws.getRow(r);
  gt.getCell(4).value = `${group} GRAND TOTAL`;
  for (const j of money) gt.getCell(j + 1).value = { formula: subtotalRows.map((x) => `${L(j)}${x.row}`).join("+") || "0" };
  gt.font = { bold: true };
  for (let i = 4; i <= r; i++) for (const j of money) ws.getRow(i).getCell(j + 1).numFmt = "#,##0";
  // challan summary
  r += 3;
  ws.getCell(`D${r}`).value = `CHALLAN SUMMARY - ${group} (${tag})`;
  ws.getCell(`D${r}`).font = { bold: true };
  r++;
  const sh = ["Unit", "EPF Employee 12%", "EPF Employer 13%", "EPS 8.33%", "EPF-EPS Diff", "ESIC Employee 0.75%", "ESIC Employer 3.25%"];
  const sk = ["pfEE", "pfER", "eps", "epfEpsDiff", "esiEE", "esiER"] as const;
  sh.forEach((h, i) => { const c = ws.getRow(r).getCell(4 + i); c.value = h; c.font = { bold: true }; c.fill = blue; });
  r++;
  const sumFirst = r;
  for (const x of subtotalRows) {
    ws.getRow(r).getCell(4).value = x.unit;
    sk.forEach((k, i) => { ws.getRow(r).getCell(5 + i).value = { formula: `${L(ci(k))}${x.row}` }; ws.getRow(r).getCell(5 + i).numFmt = "#,##0"; });
    r++;
  }
  ws.getRow(r).getCell(4).value = `${group} TOTAL`;
  sk.forEach((_, i) => { const c = ws.getRow(r).getCell(5 + i); c.value = { formula: `SUM(${ws.getColumn(5 + i).letter}${sumFirst}:${ws.getColumn(5 + i).letter}${r - 1})` }; c.numFmt = "#,##0"; });
  ws.getRow(r).font = { bold: true };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  wb.calcProperties.fullCalcOnLoad = true;
  const buf = await wb.xlsx.writeBuffer();
  return send(new Uint8Array(buf as ArrayBuffer), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `ESIC_EPFO_Combined_${group}_${tag}.xlsx`);
}
