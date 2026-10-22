/**
 * Excel export.
 *
 * The Working Salary sheet is written cell-by-cell at the exact
 * addresses used in "HZL DEBARI July-2026 with updated slips.xlsm":
 *
 *   B1              title            BE1 days in month   BF1 OT divisor
 *   B2              project line     (merged B2:AL2)
 *   B3              month            (merged B3:AL3)
 *   rows 4 and 5    two header rows, grouped columns merged across
 *   row 6 onward    one row per employee
 *
 * Column letters are hard-coded on purpose. The client reads this file
 * against their own template, so a column that drifts one place to the
 * right is worse than no export at all.
 */

import type { PayrollLine } from "./payroll";

export type SalaryRow = {
  empCode: string;
  slNo: number;
  empNo: string;
  name: string;
  plantArea: string;
  designation: string;
  category: string;
  doj: string;
  daysWorked: number;
  lop: number;
  otDays: number;
  phOtDays: number;
  nightPresents: number;
  line: PayrollLine;
  general: PayrollLine;
};

const A = (n: number): string => {
  // 1 -> A, 27 -> AA
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

/** Column positions, 1-indexed, matching the client's template exactly. */
const C = {
  empCode: 1, slNo: 2, empNo: 3, name: 4, plantArea: 5, designation: 6,
  category: 7, doj: 8,
  mwBasic: 9, mwDa: 10, mwTotal: 11,
  daysWorked: 12, lop: 13,
  basic: 14, da: 15, hra: 16, conveyance: 17, education: 18, medical: 19,
  other: 20, gross: 21,
  ot: 22, phOt: 23, np: 24, otAmount: 25, hpAmount: 26, nightAmount: 27,
  totalEarning: 28,
  pfEmp: 29, esiEmp: 30, benevolent: 31,
  pfEr: 32, esiEr: 33, wfEr: 34,
  bonus: 35, net: 36, hold: 37, ctc: 38, ctcBilling: 39,
  // General salary block
  gBasic: 41, gDa: 42, gHra: 43, gConveyance: 44, gEducation: 45,
  gMedical: 46, gOther: 47, gGross: 48,
  gPfEmp: 49, gEsiEmp: 50, gWfEmp: 51, gBenevolent: 52,
  gPfEr: 53, gEsiEr: 54, gWfEr: 55,
  gBonus: 56, gNet: 57, gCtc: 58,
} as const;

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]}-${y}`;
}

export async function buildWorkingSalaryWorkbook(opts: {
  companyName: string;
  projectLine: string;
  month: string;          // yyyy-mm-01
  daysInMonth: number;
  otDivisor: number;
  rows: SalaryRow[];
}) {
  const XLSX = await import("xlsx");
  const ws: Record<string, unknown> = {};

  const put = (col: number, row: number, v: unknown, numeric = false) => {
    if (v === null || v === undefined || v === "") return;
    ws[`${A(col)}${row}`] = numeric
      ? { t: "n", v: Number(v) }
      : { t: "s", v: String(v) };
  };

  // --- rows 1-3 ------------------------------------------------------
  put(2, 1, `Working Salary Structure for ${opts.companyName}`);
  put(C.gNet, 1, opts.daysInMonth, true);
  put(C.gCtc, 1, opts.otDivisor, true);
  put(2, 2, opts.projectLine);
  put(2, 3, monthLabel(opts.month));

  // --- row 4: primary headers ---------------------------------------
  const h4: [number, string][] = [
    [C.slNo, "Sl. No"], [C.empNo, "Emp. No."], [C.name, "Name"],
    [C.plantArea, "Plant Area"], [C.designation, "Designation"],
    [C.category, "Category"], [C.doj, "Date\nof Joining"],
    [C.mwBasic, "Minimum Wages"],
    [C.daysWorked, "No.of Days work-ed"], [C.lop, "LOP"],
    [C.basic, "Basic"], [C.da, "DA"], [C.hra, "HRA"],
    [C.conveyance, "Conveyance Allowance"], [C.education, "Education Allowance"],
    [C.medical, "Medical Allowance"], [C.other, "Other Allowance"],
    [C.gross, "Gross Salary"],
    [C.ot, "OT"], [C.phOt, "PH O.T."], [C.np, "NP"],
    [C.otAmount, "Total OT Amount"], [C.hpAmount, "Total HP Amount"],
    [C.nightAmount, "Total Night Shift Allowance"],
    [C.totalEarning, "Total Earning"],
    [C.pfEmp, "Employee Contribution"],
    [C.pfEr, "Employers Contribution"],
    [C.bonus, "Monthly Bonus"], [C.net, "Net Salary"],
    [C.hold, "Hold Salary "], [C.ctc, "CTC"],
    [C.ctcBilling, "CTC for Current Billing"],
    [C.gBasic, "Basic"], [C.gDa, "DA"], [C.gHra, "HRA"],
    [C.gConveyance, "Conveyance Allowance"], [C.gEducation, "Education Allowance"],
    [C.gMedical, "Medical Allowance"], [C.gOther, "Other Allowance"],
    [C.gGross, "Gross"],
    [C.gPfEmp, "Employee Contribution"],
    [C.gPfEr, "Employers Contribution"],
    [C.gBonus, "Monthly Bonus"], [C.gNet, "Net Salary"], [C.gCtc, "CTC"],
  ];
  h4.forEach(([c, v]) => put(c, 4, v));

  // --- row 5: sub-headers under the grouped columns ------------------
  const h5: [number, string][] = [
    [C.mwBasic, "Basic"], [C.mwDa, "DA"], [C.mwTotal, "Total"],
    [C.pfEmp, "PF \n12%"], [C.esiEmp, "ESIC\n0.75%"], [C.benevolent, "Benevolent Fund"],
    [C.pfEr, "PF     13%"], [C.esiEr, "ESIC\n3.25%"], [C.wfEr, "WF\nRs-20"],
    [C.gPfEmp, "PF \n12%"], [C.gEsiEmp, "ESIC\n0.75%"], [C.gWfEmp, "WF\nRs-5"],
    [C.gBenevolent, "Benevolent Fund"],
    [C.gPfEr, "PF     13%"], [C.gEsiEr, "ESIC\n3.25%"], [C.gWfEr, "WF\nRs-20"],
  ];
  h5.forEach(([c, v]) => put(c, 5, v));

  // --- data, from row 6 ----------------------------------------------
  opts.rows.forEach((r, i) => {
    const row = 6 + i;
    const L = r.line;
    const G = r.general;

    put(C.empCode, row, r.empCode);
    put(C.slNo, row, r.slNo, true);
    put(C.empNo, row, r.empNo);
    put(C.name, row, r.name);
    put(C.plantArea, row, r.plantArea);
    put(C.designation, row, r.designation);
    put(C.category, row, r.category);
    put(C.doj, row, r.doj);

    put(C.mwBasic, row, L.mwBasic, true);
    put(C.mwDa, row, L.mwDa, true);
    put(C.mwTotal, row, L.mwTotal, true);
    put(C.daysWorked, row, r.daysWorked, true);
    put(C.lop, row, r.lop, true);

    put(C.basic, row, L.basic, true);
    put(C.da, row, L.da, true);
    put(C.hra, row, L.hra, true);
    put(C.conveyance, row, L.conveyance, true);
    put(C.education, row, L.education, true);
    put(C.medical, row, L.medical, true);
    put(C.other, row, L.other, true);
    put(C.gross, row, L.gross, true);

    put(C.ot, row, r.otDays, true);
    put(C.phOt, row, r.phOtDays, true);
    put(C.np, row, r.nightPresents, true);
    put(C.otAmount, row, L.otAmount, true);
    put(C.hpAmount, row, L.hpAmount, true);
    put(C.nightAmount, row, L.nightAmount, true);
    put(C.totalEarning, row, L.totalEarning, true);

    put(C.pfEmp, row, L.pfEmployee, true);
    put(C.esiEmp, row, L.esiEmployee, true);
    put(C.benevolent, row, L.benevolent, true);
    put(C.pfEr, row, L.pfEmployer, true);
    put(C.esiEr, row, L.esiEmployer, true);
    put(C.wfEr, row, L.wfEmployer, true);

    put(C.bonus, row, L.monthlyBonus, true);
    put(C.net, row, L.netSalary, true);
    put(C.hold, row, L.holdAmount, true);
    put(C.ctc, row, L.ctc, true);
    put(C.ctcBilling, row, L.ctcForBilling, true);

    put(C.gBasic, row, G.basic, true);
    put(C.gDa, row, G.da, true);
    put(C.gHra, row, G.hra, true);
    put(C.gConveyance, row, G.conveyance, true);
    put(C.gEducation, row, G.education, true);
    put(C.gMedical, row, G.medical, true);
    put(C.gOther, row, G.other, true);
    put(C.gGross, row, G.gross, true);
    put(C.gPfEmp, row, G.pfEmployee, true);
    put(C.gEsiEmp, row, G.esiEmployee, true);
    put(C.gWfEmp, row, G.wfEmployee, true);
    put(C.gBenevolent, row, G.benevolent, true);
    put(C.gPfEr, row, G.pfEmployer, true);
    put(C.gEsiEr, row, G.esiEmployer, true);
    put(C.gWfEr, row, G.wfEmployer, true);
    put(C.gBonus, row, G.monthlyBonus, true);
    put(C.gNet, row, G.netSalary, true);
    put(C.gCtc, row, G.ctc, true);
  });

  const lastRow = 5 + Math.max(opts.rows.length, 1);
  ws["!ref"] = `A1:${A(C.gCtc)}${lastRow}`;

  // Merges that make rows 4/5 read as one banded header, as in the original.
  const single = [
    C.slNo, C.empNo, C.name, C.plantArea, C.designation, C.category, C.doj,
    C.daysWorked, C.lop, C.basic, C.da, C.hra, C.conveyance, C.education,
    C.medical, C.other, C.gross, C.ot, C.phOt, C.np, C.otAmount, C.hpAmount,
    C.nightAmount, C.totalEarning, C.bonus, C.net, C.hold, C.ctc, C.ctcBilling,
    C.gBasic, C.gDa, C.gHra, C.gConveyance, C.gEducation, C.gMedical,
    C.gOther, C.gGross, C.gBonus, C.gNet, C.gCtc,
  ];

  ws["!merges"] = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 37 } },  // B2:AL2
    { s: { r: 2, c: 1 }, e: { r: 2, c: 37 } },  // B3:AL3
    { s: { r: 3, c: C.mwBasic - 1 }, e: { r: 3, c: C.mwTotal - 1 } },
    { s: { r: 3, c: C.pfEmp - 1 }, e: { r: 3, c: C.benevolent - 1 } },
    { s: { r: 3, c: C.pfEr - 1 }, e: { r: 3, c: C.wfEr - 1 } },
    { s: { r: 3, c: C.gPfEmp - 1 }, e: { r: 3, c: C.gBenevolent - 1 } },
    { s: { r: 3, c: C.gPfEr - 1 }, e: { r: 3, c: C.gWfEr - 1 } },
    ...single.map((c) => ({ s: { r: 3, c: c - 1 }, e: { r: 4, c: c - 1 } })),
  ];

  ws["!cols"] = Array.from({ length: C.gCtc }, (_, i) => ({
    wch: i === C.name - 1 ? 26 : i === C.designation - 1 ? 20 : 11,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws as never, `Working Salary ${monthLabel(opts.month)}`.slice(0, 31));
  return { XLSX, wb };
}

export async function downloadWorkingSalary(opts: Parameters<typeof buildWorkingSalaryWorkbook>[0] & { fileName: string }) {
  const { XLSX, wb } = await buildWorkingSalaryWorkbook(opts);
  XLSX.writeFile(wb, opts.fileName);
}

/** Plain employee master export. */
export async function downloadEmployees(
  rows: Record<string, unknown>[],
  fileName: string,
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({
    wch: Math.min(Math.max(k.length + 2, 12), 30),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  XLSX.writeFile(wb, fileName);
}
