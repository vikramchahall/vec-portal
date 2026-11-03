import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { audit, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { monthSalary } from "@/lib/payroll";
import { WS_COLUMNS } from "@/lib/engine/salary";

export const dynamic = "force-dynamic";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const col = (n: number) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const num = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const FILL: Record<string, string> = { WO: "FFC6EFCE", X: "FFFFC7CE", L: "FFFFEB9C", CL: "FFF8CBAD", H: "FFBDD7EE", HP: "FFD9D2E9" };

/**
 * Working_Salary_<UNIT>_<Mon>-<YYYY>.xlsx with the sheets, column letters and formulas of the
 * October-2026 workbooks, so it works in Excel exactly like the files the team uses:
 * a code typed into Punch Attendance re-runs the L / CL cover and the salary.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const q = new URL(req.url).searchParams;
  const unit = q.get("unit") ?? "";
  const [y, m] = (q.get("month") ?? "").split("-").map(Number);
  if (!unit || !y || !m) return new Response("unit and month are required", { status: 400 });
  const ms = await monthSalary(unit, y, m);
  if (!ms) return new Response("Unknown unit", { status: 404 });
  const rows = ms.rows.filter((r) => r.line);
  const tag = `${MON[m - 1]}-${String(y).slice(2)}`;
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
  const cover = unit !== "DRIVERS";
  const D = ms.days;
  const wb = new ExcelJS.Workbook();
  wb.creator = "VEC Portal";
  wb.calcProperties.fullCalcOnLoad = true;
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const head = (ws: ExcelJS.Worksheet, r: number, cells: Record<string, string>) => {
    for (const [c, v] of Object.entries(cells)) {
      const x = ws.getCell(`${c}${r}`);
      x.value = v; x.font = { bold: true }; x.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
      x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3F7" } }; x.border = border;
    }
  };
  const ident = (ws: ExcelJS.Worksheet, r: number, row: (typeof rows)[number], i: number) => {
    ws.getCell(r, 1).value = /^\d+$/.test(row.p.card) ? Number(row.p.card) : row.p.card;
    ws.getCell(r, 2).value = i + 1;
    ws.getCell(r, 3).value = row.regNo && /^\d+$/.test(row.regNo) ? Number(row.regNo) : row.regNo ?? "";
    ws.getCell(r, 4).value = row.p.name;
    ws.getCell(r, 5).value = row.p.designation ?? "";
    ws.getCell(r, 6).value = row.category ?? "";
    ws.getCell(r, 7).value = row.doj ? row.doj.split("-").reverse().join(".") : "";
  };
  const F = (ws: ExcelJS.Worksheet, ref: string, formula: string, result: number | string) => { ws.getCell(ref).value = { formula, result }; };
  const dayCols = (fn: (c: string, d: number) => void) => { for (let d = 1; d <= 31; d++) fn(col(7 + d), d); };
  const header = (ws: ExcelJS.Worksheet, title: string) => {
    ws.getCell("H1").value = "VIKRAM ENGINEERING CO. A SUB CONTRACTOR OF AQUATECH SYSTEMS ASIA PVT. LTD.";
    ws.getCell("H2").value = `Plant- ${ms.unit.workOrders.join(", ") || unit}-HMEL - Bathinda Site`;
    ws.getCell("H3").value = title;
    for (const c of ["H1", "H2", "H3"]) ws.getCell(c).font = { bold: true };
    head(ws, 4, { B: "Sr.\nNo.", C: "Register\nNo.", D: "Name ", E: "Designation", F: "Grade", G: "Date of joining" });
    dayCols((c, d) => {
      if (d > D) return;
      ws.getCell(`${c}5`).value = d;
      ws.getCell(`${c}6`).value = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      for (const r of [5, 6]) { ws.getCell(`${c}${r}`).font = { bold: true }; ws.getCell(`${c}${r}`).alignment = { horizontal: "center" }; }
    });
    ws.getColumn(4).width = 24; ws.getColumn(5).width = 18;
    for (let c = 8; c <= 38; c++) ws.getColumn(c).width = 4.5;
    ws.views = [{ state: "frozen", xSplit: 7, ySplit: 6 }];
  };

  // ---------- Punch Attendance: raw codes after the weekly-off rule (edit codes here) ----------
  const pa = wb.addWorksheet("Punch Attendance");
  header(pa, `Punch codes after weekly-off rule (01-${D} ${monthName} ${y}). Edit codes HERE - L/CL cover is applied in Attendance Format from the leave balance.`);
  head(pa, 4, { AN: "L available (whole days)", AO: "CL available (whole days)" });
  // ---------- Attendance Format ----------
  const af = wb.addWorksheet("Attendance Format");
  header(af, `Attendance 01-${D} ${monthName} ${y}`);
  head(af, 4, { AM: "Days \nPresent", AN: "H", AO: "HP", AP: "W\nOFF", AQ: "L/\nPL", AR: "CL", AS: "X (ABSENT)", AT: "Total\nDays Pybl", BD: "Assumed Weekly Off" });
  head(af, 5, { AV: "B/F", AX: "Credited", AZ: "Used", BB: "Balance" });
  head(af, 6, { AV: "C-Off", AW: "Monthly", AX: "C-Off", AY: "Monthly", AZ: "C-Off", BA: "Monthly", BB: "C-Off", BC: "Monthly" });
  // ---------- C-Off ----------
  const co = wb.addWorksheet("C-Off");
  header(co, `Extra Hrs. Attendance 01 to ${D} ${monthName} ${y} (extra / short hours per day, 0.5 h steps)`);
  head(co, 4, { AM: "Excess Hours", AN: "Less Hours", AO: "CL Hours", AP: "Total CL" });

  rows.forEach((row, i) => {
    const r = 7 + i, b = row.p.b!;
    for (const ws of [pa, af, co]) ident(ws, r, row, i);
    dayCols((c, d) => {
      if (d > D) return;
      const raw = row.p.raw[d - 1] ?? "", fin = b.final[d - 1] ?? "";
      pa.getCell(`${c}${r}`).value = raw || null;
      const pr = `'Punch Attendance'!`;
      const fx = cover
        ? `IF(${pr}${c}${r}="X",IF(COUNTIF(${pr}$H${r}:${c}${r},"X")<=${pr}$AN${r},"L",IF(COUNTIF(${pr}$H${r}:${c}${r},"X")<=${pr}$AN${r}+${pr}$AO${r},"CL","X")),IF(${pr}${c}${r}="","",${pr}${c}${r}))`
        : `IF(${pr}${c}${r}="","",${pr}${c}${r})`;
      F(af, `${c}${r}`, fx, fin);
      if (FILL[fin]) af.getCell(`${c}${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[fin] } };
      const dut = row.p.duties.find((x) => x.day === d);
      if (dut && (raw === "P" || raw === "HP") && dut.coff && row.p.overrides.get(d)?.code !== "NOPUNCH") co.getCell(`${c}${r}`).value = dut.coff;
    });
    F(pa, `AN${r}`, `MAX(0,INT(ROUND('Attendance Format'!$AW${r}+(COUNTIF($H${r}:$AL${r},"P")+COUNTIF($H${r}:$AL${r},"HP"))*0.064,6))-COUNTIF($H${r}:$AL${r},"L"))`, b.avail.l);
    F(pa, `AO${r}`, `MAX(0,INT(ROUND('Attendance Format'!$AV${r}+IFERROR('Attendance Format'!$AX${r}+0,0),6))-COUNTIF($H${r}:$AL${r},"CL"))`, b.avail.cl);
    const cnt = (code: string) => `COUNTIF($H${r}:$AL${r},"${code}")`;
    F(af, `AM${r}`, cnt("P"), b.counts.P); F(af, `AN${r}`, cnt("H"), b.counts.H); F(af, `AO${r}`, cnt("HP"), b.counts.HP);
    F(af, `AP${r}`, `${cnt("WO")}+${cnt("OD")}`, b.counts.WO); F(af, `AQ${r}`, cnt("L"), b.counts.L); F(af, `AR${r}`, cnt("CL"), b.counts.CL);
    F(af, `AS${r}`, cnt("X"), b.counts.X); F(af, `AT${r}`, `SUM(AM${r}:AR${r})`, b.counts.payable);
    af.getCell(`AV${r}`).value = b.bf.cl; af.getCell(`AW${r}`).value = b.bf.l;
    F(af, `AX${r}`, `VLOOKUP(A${r},'C-Off'!$A:$AQ,42,0)`, b.credit.cl); F(af, `AY${r}`, `(AM${r}+AO${r})*0.064`, b.credit.l);
    F(af, `AZ${r}`, `AR${r}`, b.used.cl); F(af, `BA${r}`, `AQ${r}`, b.used.l);
    F(af, `BB${r}`, `AV${r}+AX${r}-AZ${r}`, b.close.cl); F(af, `BC${r}`, `AW${r}+AY${r}-BA${r}`, b.close.l);
    af.getCell(`BD${r}`).value = row.p.woWeekday ?? "Sun";
    F(co, `AM${r}`, `SUMIF(H${r}:AL${r},">0")`, b.coff.excess); F(co, `AN${r}`, `SUMIF(H${r}:AL${r},"<0")`, b.coff.less);
    F(co, `AO${r}`, `(AM${r}*2)+AN${r}`, b.coff.clHours); F(co, `AP${r}`, `AO${r}/8`, b.coff.totalCl);
  });

  // ---------- General Salary (full-month structure) ----------
  const gs = wb.addWorksheet("General Salary");
  gs.getCell("B1").value = `General Salary Structure for Vikram Engg Employees_${ms.unit.workOrders.join(", ")}`;
  gs.getCell("B1").font = { bold: true };
  head(gs, 4, { B: "Sl. No", C: "Register No.", D: "Name", E: "Designation", F: "Category", G: "Date\nof Joining", H: "Basic", I: "DA", J: "Total", AG: "Basic + DA", AH: "DA", AI: "HRA", AJ: "Special Allowance", AK: "Conveyance Allowance" });
  rows.forEach((row, i) => {
    const r = 6 + i, s = row.structure!;
    ident(gs, r, row, i);
    F(gs, `H${r}`, `J${r}-I${r}`, s.basicDa * 0.75); F(gs, `I${r}`, `J${r}*25%`, s.basicDa * 0.25); F(gs, `J${r}`, `AG${r}`, s.basicDa);
    gs.getCell(`AG${r}`).value = s.basicDa; gs.getCell(`AH${r}`).value = 0; gs.getCell(`AI${r}`).value = s.hra;
    gs.getCell(`AJ${r}`).value = s.special; gs.getCell(`AK${r}`).value = s.conveyance + s.others;
  });

  // ---------- Working Salary ----------
  const ws = wb.addWorksheet(`Working Salary ${tag}`, { views: [{ state: "frozen", xSplit: 4, ySplit: 5 }] });
  ws.getCell("B1").value = `Working Salary Structure for Vikram Engg Employees_${ms.unit.workOrders.join(", ")} (${ms.unit.name})`;
  ws.getCell("B2").value = `Project  : HMEL, REFINERY, BATHINDA   |   PERIOD: 01-${D} ${monthName} ${y} (EPF wage ceiling Rs ${ms.settings.pfCeiling.toLocaleString("en-IN")})`;
  ws.getCell("B3").value = new Date(Date.UTC(y, m - 1, 1));
  ws.getCell("B3").numFmt = "mmm-yy";
  for (const c of ["B1", "B2", "B3"]) ws.getCell(c).font = { bold: true };
  ws.getCell("BB1").value = D; ws.getCell("BC1").value = ms.settings.hpDivisor;
  ws.getCell("BD2").value = "PT if annual gross above (Rs)"; ws.getCell("BE2").value = ms.settings.ptAnnualAbove;
  ws.getCell("BE1").value = "PT per month (Rs)"; ws.getCell("BF1").value = ms.settings.ptAmount;
  ws.getCell("BG2").value = "Days in this period"; ws.getCell("BH2").value = D;
  ws.getCell("BG3").value = "PF ceiling for this period"; F(ws, "BH3", "ROUND(BI1*BH2/$BB$1,0)", ms.settings.pfCeiling);
  ws.getCell("BH1").value = "PF wage ceiling (Rs / month)"; ws.getCell("BI1").value = ms.settings.pfCeilingFull;
  head(ws, 4, { B: "Sl. No", C: "Register No.", D: "Name", E: "Designation", F: "Category", G: "Date\nof Joining", H: "Minimum Wages", K: "No.of Days Payable", L: "LOP", M: "Basic + DA", N: "DA", O: "HRA", P: "Special Allowance", Q: "Conveyance Allowance", R: "Gross Salary", S: "OT", T: "HP", U: "Total OT Amount", V: "Total HP Amount", W: "Total Earning", X: "Employee Contribution", AA: "Employers Contribution", AD: "Monthly Bonus", AE: "Annual Bonus", AF: "Leave Encashment", AG: "Net Salary", AH: "Professional Tax (PSDT)", AI: "Net Payable after PT", AJ: "Hold Salary", AK: "CTC", AL: `CTC for Current Billing (${tag})`, AN: "Basic + DA", AO: "DA", AP: "HRA", AQ: "Special Allowance", AR: "Conveyance Allowance", AS: "Gross", AT: "Employee Contribution", AW: "Employers Contribution", AZ: "Monthly Bonus", BA: "Net Salary", BB: "CTC", BC: "PF", BD: "ESI", BE: "Bonus", BJ: "Payable days (for PT)", BK: "Annual bonus" });
  head(ws, 5, { H: "Basic", I: "DA", J: "Total", X: "PF \n12%", Y: "ESIC\n0.75%", Z: "WF\nRs-5", AA: "PF     13%", AB: "ESIC\n3.25%", AC: "WF\nRs-20", AT: "PF \n12%", AU: "ESIC\n0.75%", AV: "WF\nRs-5", AW: "PF     13%", AX: "ESIC\n3.25%", AY: "WF\nRs-20" });
  const GSR = `'General Salary'!$A:$AW`, AFR = `'Attendance Format'!$A:$AT`;
  rows.forEach((row, i) => {
    const r = 6 + i, l = row.line!, s = row.structure!;
    ident(ws, r, row, i);
    const v = (c: string, f: string, res: number) => F(ws, `${c}${r}`, f, res);
    v("H", `VLOOKUP(A${r},${GSR},8,0)`, s.basicDa * 0.75); v("I", `VLOOKUP(A${r},${GSR},9,0)`, s.basicDa * 0.25); v("J", `SUM(H${r}:I${r})`, s.basicDa);
    v("K", `VLOOKUP(A${r},${AFR},46,0)`, l.payableDays); v("L", `VLOOKUP(A${r},${AFR},45,0)`, l.lop);
    v("M", `ROUNDUP((J${r}/$BB$1)*K${r},0)`, l.earnedBasicDa); v("N", `ROUNDUP((AO${r}/$BB$1*K${r}),0)`, l.earnedDa);
    v("O", `ROUNDUP((AP${r}/$BB$1*K${r}),0)`, l.earnedHra); v("P", `ROUNDUP((AQ${r}/$BB$1*K${r}),0)`, l.earnedSpecial);
    v("Q", `ROUNDUP((AR${r}/$BB$1*K${r}),0)`, l.earnedConveyance); v("R", `SUM(M${r}:Q${r})`, l.gross);
    ws.getCell(`S${r}`).value = l.otDays;
    v("T", `VLOOKUP(A${r},${AFR},41,0)`, l.hpDays); v("U", `ROUNDUP(((AS${r}/26)*S${r})*2,0)`, l.otAmount); v("V", `ROUNDUP((AS${r}/26)*T${r},0)`, l.hpAmount);
    v("W", `R${r}+U${r}+V${r}`, l.totalEarning);
    v("X", `ROUNDUP(IF((R${r}-O${r})>$BH$3,($BH$3*12%),(R${r}-O${r})*12%)*BC${r},0)`, l.pf);
    v("Y", `ROUNDUP((SUM(W${r}+AD${r})*0.75%)*BD${r},0)`, l.esi); ws.getCell(`Z${r}`).value = 5;
    v("AA", `ROUNDUP(IF((R${r}-O${r})>$BH$3,($BH$3*13%),(R${r}-O${r})*13%)*BC${r},0)`, l.pfEmployer);
    v("AB", `ROUNDUP((SUM(W${r}+AD${r})*3.25%)*BD${r},0)`, l.esiEmployer); ws.getCell(`AC${r}`).value = 20;
    v("AD", `ROUNDUP(M${r}*0.0833,0)*BE${r}`, l.bonus); v("AE", `IF(BE${r},0,1)*ROUNDUP(M${r}*0.0833,0)*BK${r}`, l.annualBonus);
    ws.getCell(`AF${r}`).value = l.leaveEncashment;
    v("AG", `W${r}-X${r}-Y${r}-Z${r}+AD${r}-AJ${r}+AF${r}`, l.net); v("AH", `IF(AND(BJ${r}>0,AS${r}*12>$BE$2),$BF$1,0)`, l.pt);
    v("AI", `AG${r}-AH${r}`, l.netAfterPt); ws.getCell(`AJ${r}`).value = l.hold;
    v("AK", `W${r}+AA${r}+AB${r}+AC${r}+AD${r}+AE${r}+AF${r}`, l.ctc); v("AL", `AK${r}-AJ${r}`, l.ctcBilling);
    v("AN", `VLOOKUP(A${r},${GSR},33,0)`, s.basicDa); v("AO", `VLOOKUP(A${r},${GSR},34,0)`, 0); v("AP", `VLOOKUP(A${r},${GSR},35,0)`, s.hra);
    v("AQ", `VLOOKUP(A${r},${GSR},36,0)`, s.special); v("AR", `VLOOKUP(A${r},${GSR},37,0)`, s.conveyance + s.others); v("AS", `SUM(AN${r}:AR${r})`, l.full.gross);
    v("AT", `ROUNDUP(IF(SUM(AS${r}-AP${r})>$BI$1,($BI$1*12%),(AS${r}-AP${r})*12%),0)`, l.full.pf);
    v("AU", `ROUNDUP(IF(AS${r}>=21000,(0),(AS${r}+AZ${r})*0.75%),0)`, l.full.esi); ws.getCell(`AV${r}`).value = 5;
    v("AW", `ROUNDUP(IF(SUM(AS${r}-AP${r})>$BI$1,($BI$1*13%),(AS${r}-AP${r})*13%),0)`, l.full.pfEmployer);
    v("AX", `ROUNDUP(IF(AS${r}>=21000,(0),(AS${r}+AZ${r})*3.25%),0)`, l.full.esiEmployer); ws.getCell(`AY${r}`).value = 20;
    v("AZ", `ROUNDUP(AN${r}*0.0833,0)`, l.full.bonus); v("BA", `ROUNDUP(((AS${r}-AV${r}-AT${r}-AU${r})+AZ${r}),0)`, l.full.net);
    v("BB", `ROUNDUP((AS${r}+AY${r}+AW${r}+AZ${r}+AX${r}),0)`, l.full.ctc);
    // membership flags come from the employee master (PF member, ESIC member, monthly bonus)
    ws.getCell(`BC${r}`).value = row.pf ? 1 : 0; ws.getCell(`BD${r}`).value = row.esi ? 1 : 0;
    ws.getCell(`BE${r}`).value = row.bonusMonthly && !row.isDriver ? 1 : 0; ws.getCell(`BK${r}`).value = row.isDriver || unit === "DRIVERS" ? 0 : 1;
    v("BJ", `K${r}`, l.payableDays);
  });
  const last = 5 + rows.length, tot = last + 2;
  ws.getCell(`D${tot}`).value = "Total";
  for (const [L, f] of WS_COLUMNS) F(ws, `${L}${tot}`, `SUM(${L}6:${L}${last})`, rows.reduce((s, r) => s + f(r.line!), 0));
  ws.getRow(tot).font = { bold: true };
  for (let r = 6; r <= last; r++) for (let c = num("H"); c <= num("AL"); c++) ws.getCell(r, c).numFmt = "#,##0";
  ws.getColumn(4).width = 24; ws.getColumn(5).width = 18;
  for (let c = num("H"); c <= num("AL"); c++) ws.getColumn(c).width = 10;

  // ---------- Master Sheet (bank and statutory numbers; full account numbers for the owner) ----------
  const master = wb.addWorksheet("Master Sheet");
  master.addRow(["Employee Code", "Sl. No.", "EMPLOYEE NAME", "DESIGNATION", "LOCATION", "ESI NUMBER", "PF ACCOUNT NUMBER", "BANK NAME", "BANK ACCOUNT NO.", "IFSC CODE", "UAN NO.", "NET SALARY"]).font = { bold: true };
  const accounts = new Map<number, string>();
  if (user.role === "owner" && rows.length) {
    const enc = (await db().execute(sql`SELECT id, account_enc FROM employees WHERE id IN (${sql.join(rows.map((r) => sql`${r.p.employeeId}`), sql`, `)})`)) as unknown as { id: number; account_enc: string | null }[];
    for (const e of enc) if (e.account_enc) accounts.set(e.id, decrypt(e.account_enc));
  }
  rows.forEach((row, i) => {
    const r = master.addRow([/^\d+$/.test(row.p.card) ? Number(row.p.card) : row.p.card, i + 1, row.p.name, row.p.designation ?? "", `${unit},HMEL`, row.esicIp ?? "", row.pfAccount ?? "",
      row.bank.name ?? "", accounts.get(row.p.employeeId!) ?? (row.bank.last4 ? "XXXXXXXX" + row.bank.last4 : ""), row.bank.ifsc ?? "", row.uan ?? ""]);
    r.getCell(12).value = { formula: `VLOOKUP(A${i + 2},'Working Salary ${tag}'!$A:$AI,35,0)`, result: row.line!.netAfterPt };
  });
  [12, 6, 26, 22, 16, 14, 18, 26, 20, 14, 15, 12].forEach((w, i) => { master.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  await audit(user.email, "export", "working_salary", `${unit} ${q.get("month")}`, { people: rows.length, netAfterPt: ms.totals.netAfterPt });
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="Working_Salary_${unit}_${MON[m - 1]}-${y}.xlsx"`, "Cache-Control": "no-store" },
  });
}
