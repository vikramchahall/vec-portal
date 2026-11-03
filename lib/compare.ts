import "server-only";
import * as XLSX from "xlsx";
import { calcSalary, WS_COLUMNS, type SalaryLine } from "@/lib/engine/salary";
import type { MonthSalary } from "@/lib/payroll";

/**
 * Compare the portal's Working Salary with one made by hand in Excel (same unit and month).
 * Every difference is traced to an input — day codes, leave B/F, pay structure, PF/ESIC/bonus flags,
 * OT days / hold / leave encashment — and the portal's formulas are re-run on the file's own inputs
 * to show whether the rupees then agree.
 */

export type ColDiff = { col: string; label: string; file: number; portal: number };
export type DayDiff = { day: number; file: string; portal: string };
export type PersonCompare = {
  card: string; name: string;
  status: "same" | "differs" | "only-file" | "only-portal" | "no-structure";
  reasons: string[]; cols: ColDiff[]; days: DayDiff[];
  sameWithFileInputs: boolean | null; // portal formulas on the file's inputs give the file's rupees
};
export type CompareResult = {
  sheet: string; people: PersonCompare[]; warnings: string[];
  totals: { col: string; label: string; file: number; portal: number }[];
};

type Grid = unknown[][];
const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[,₹\s]/g, "")) || 0);
const cardOf = (v: unknown) => { const s = String(v ?? "").trim(); return /^\d{5,}$/.test(s) ? s : null; };
const colIdx = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const grid = (wb: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const fmt = (x: number) => (Number.isInteger(x) ? x.toLocaleString("en-IN") : x.toFixed(2));

function headerRow(g: Grid, labels: string[]) {
  for (let r = 0; r < Math.min(10, g.length); r++) {
    const cells = (g[r] ?? []).map(norm);
    if (labels.every((l) => cells.some((c) => c === l || c.startsWith(l)))) return r;
  }
  return -1;
}

type FileRow = {
  card: string; name: string; v: Record<string, number>;
  structure: { basicDa: number; da: number; hra: number; special: number; conveyance: number } | null;
  codes: string[] | null; bf: { cl: number; l: number } | null;
};

function readFile(wb: XLSX.WorkBook, days: number, warnings: string[]): { sheet: string; rows: Map<string, FileRow>; labels: Record<string, string> } {
  const sheet = wb.SheetNames.find((n) => /^working salary/i.test(n.trim()));
  if (!sheet) throw new Error('No sheet starting with "Working Salary" in this file.');
  const g = grid(wb, sheet);
  const h = headerRow(g, ["name", "designation"]);
  if (h < 0) throw new Error(`Could not find the header row (Name, Designation) in "${sheet}".`);
  const labels: Record<string, string> = {};
  for (const [c] of WS_COLUMNS) {
    const i = colIdx(c);
    let top = ""; for (let k = i; k >= 0 && !top; k--) top = String(g[h]?.[k] ?? "").replace(/\s+/g, " ").trim();
    const sub = String(g[h + 1]?.[i] ?? "").replace(/\s+/g, " ").trim();
    labels[c] = sub && sub !== top ? `${top} · ${sub}` : top;
  }
  const basics = (g[h] ?? []).map((v, i) => (norm(v) === "basic + da" ? i : -1)).filter((i) => i >= 0);
  const sb = basics[1];
  if (sb === undefined) warnings.push("The full-month structure (second “Basic + DA” column) was not found — structures are not compared.");

  const rows = new Map<string, FileRow>();
  for (let r = h + 2; r < g.length; r++) {
    const row = g[r] ?? [];
    const card = cardOf(row[0]);
    const name = String(row[3] ?? "").trim();
    if (!card || /^total/i.test(name)) continue;
    const v: Record<string, number> = {};
    for (const [c] of WS_COLUMNS) v[c] = num(row[colIdx(c)]);
    rows.set(card, { card, name, v, codes: null, bf: null,
      structure: sb === undefined ? null : { basicDa: num(row[sb]), da: num(row[sb + 1]), hra: num(row[sb + 2]), special: num(row[sb + 3]), conveyance: num(row[sb + 4]) } });
  }

  // Attendance Format: the day codes after L/CL cover, and the leave brought forward
  const af = wb.SheetNames.find((n) => /^attendance format/i.test(n.trim()));
  if (!af) { warnings.push("No Attendance Format sheet — day codes and leave B/F are not compared."); return { sheet, rows, labels }; }
  const a = grid(wb, af);
  const ah = headerRow(a, ["name"]);
  const dayRow = a[ah + 1] ?? [];
  const d1 = dayRow.findIndex((v, i) => num(v) === 1 && num(dayRow[i + 1]) === 2);
  const bfCol = dayRow.findIndex((v) => norm(v).startsWith("b/f"));
  if (d1 < 0) warnings.push("Day columns 1, 2, 3 … not found in Attendance Format — day codes are not compared.");
  for (let r = ah + 1; r < a.length; r++) {
    const x = rows.get(cardOf(a[r]?.[0]) ?? "");
    if (!x) continue;
    if (d1 >= 0) x.codes = Array.from({ length: days }, (_, i) => String(a[r]?.[d1 + i] ?? "").trim().toUpperCase());
    if (bfCol >= 0) x.bf = { cl: num(a[r]?.[bfCol]), l: num(a[r]?.[bfCol + 1]) };
  }
  return { sheet, rows, labels };
}

export function compareWithExcel(buf: Buffer, ms: MonthSalary): CompareResult {
  const warnings: string[] = [];
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const { sheet, rows: file, labels } = readFile(wb, ms.days, warnings);
  const people: PersonCompare[] = [];
  const seen = new Set<string>();
  const sumF: Record<string, number> = {}, sumP: Record<string, number> = {};

  for (const r of ms.rows) {
    const card = r.p.card;
    const f = file.get(card);
    seen.add(card);
    const line = r.line;
    if (line) for (const [c, fn] of WS_COLUMNS) sumP[c] = (sumP[c] ?? 0) + fn(line);
    if (!f) { people.push({ card, name: r.p.name, status: "only-portal", reasons: ["In the portal but not in the Excel file"], cols: [], days: [], sameWithFileInputs: null }); continue; }
    for (const [c] of WS_COLUMNS) sumF[c] = (sumF[c] ?? 0) + f.v[c];
    if (!line || !r.structure) { people.push({ card, name: r.p.name, status: "no-structure", reasons: ["No pay structure in the portal — import the employee master or add one"], cols: [], days: [], sameWithFileInputs: null }); continue; }

    const reasons: string[] = [];
    const cols: ColDiff[] = WS_COLUMNS.map(([c, fn]) => ({ col: c, label: labels[c], file: f.v[c], portal: fn(line) })).filter((d) => !near(d.file, d.portal));

    // 1. day codes (after L / CL cover)
    const days: DayDiff[] = [];
    if (f.codes) r.p.final.forEach((code, i) => { const fc = f.codes![i] ?? ""; if (fc !== (code ?? "")) days.push({ day: i + 1, file: fc || "blank", portal: code || "blank" }); });
    if (days.length) reasons.push(`Day codes differ on ${days.length} day${days.length > 1 ? "s" : ""}: ${days.slice(0, 6).map((d) => `${d.day}: file ${d.file}, portal ${d.portal}`).join("; ")}${days.length > 6 ? " …" : ""}`);
    // 2. leave brought forward (decides how many X days L / CL can cover)
    const bf = r.p.b?.bf;
    if (f.bf && bf && (!near(f.bf.cl, bf.cl) || !near(f.bf.l, bf.l)))
      reasons.push(`Leave B/F differs — file CL ${fmt(f.bf.cl)}, L ${fmt(f.bf.l)}; portal CL ${fmt(bf.cl)}, L ${fmt(bf.l)}${r.p.hasOpening ? "" : " (no opening balance loaded in the portal)"}`);
    // 3. pay structure
    const ps = r.structure, fs = f.structure;
    if (fs) {
      const pc = ps.conveyance + ps.others;
      const parts = ([["Basic + DA", fs.basicDa + fs.da, ps.basicDa], ["HRA", fs.hra, ps.hra], ["Special", fs.special, ps.special], ["Conveyance / others", fs.conveyance, pc]] as const)
        .filter(([, a, b]) => !near(a, b)).map(([n, a, b]) => `${n} file ${fmt(a)}, portal ${fmt(b)}`);
      if (parts.length) reasons.push(`Pay structure differs — ${parts.join("; ")}`);
    }
    // 4. PF / ESIC / monthly bonus (seen from whether the file deducts them)
    if (f.v.K > 0) {
      const flags = ([["PF", f.v.X > 0, r.pf, "X"], ["ESIC", f.v.Y > 0, r.esi, "Y"], ["Monthly bonus", f.v.AD > 0, line.bonus > 0, "AD"]] as const)
        .filter(([, a, b]) => a !== b).map(([n, a]) => `${n} ${a ? "deducted/paid in the file, not in the portal" : "in the portal, not in the file"}`);
      if (flags.length) reasons.push(`Flags differ — ${flags.join("; ")}`);
    }
    // 5. entries made by hand for the month
    const entries = ([["OT days", f.v.S, line.otDays], ["Hold", f.v.AJ, line.hold], ["Leave encashment", f.v.AF, line.leaveEncashment]] as const)
      .filter(([, a, b]) => !near(a, b)).map(([n, a, b]) => `${n} file ${fmt(a)}, portal ${fmt(b)}`);
    if (entries.length) reasons.push(`Month entries differ — ${entries.join("; ")} (Working Salary → Adjust)`);

    // the portal's formulas on the file's own inputs
    let same: boolean | null = null;
    if (fs) {
      const driver = r.isDriver || ms.unit.code === "DRIVERS";
      const l2: SalaryLine = calcSalary({
        structure: { basicDa: fs.basicDa, da: fs.da, hra: fs.hra, special: fs.special, conveyance: fs.conveyance },
        payableDays: f.v.K, lopDays: f.v.L, hpDays: f.v.T, otDays: f.v.S, pf: f.v.X > 0 || (f.v.K === 0 && r.pf), esi: f.v.Y > 0 || (f.v.K === 0 && r.esi),
        bonusMonthly: f.v.AD > 0, annualBonus: !driver, hold: f.v.AJ, leaveEncashment: f.v.AF,
      }, ms.settings);
      const off = WS_COLUMNS.filter(([c, fn]) => !near(fn(l2), f.v[c]));
      same = off.length === 0;
      if (!same && cols.length) reasons.push(`Even with the file's own days and structure the rupees differ in ${off.map(([c]) => c).join(", ")} — the sheet's formula for this row may have been changed by hand`);
    }
    if (cols.length && !reasons.length) reasons.push("Rupees differ but no input differs — check the row's formulas in the file");
    people.push({ card, name: r.p.name, status: cols.length || days.length ? "differs" : "same", reasons, cols, days, sameWithFileInputs: same });
  }
  for (const f of file.values()) if (!seen.has(f.card)) {
    for (const [c] of WS_COLUMNS) sumF[c] = (sumF[c] ?? 0) + f.v[c];
    people.push({ card: f.card, name: f.name, status: "only-file", reasons: [`In the Excel file but not in the portal for ${ms.unit.code} — the card is not on the employee master or not assigned to this unit`], cols: [], days: [], sameWithFileInputs: null });
  }
  const order = { differs: 0, "only-file": 1, "only-portal": 2, "no-structure": 3, same: 4 };
  people.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  const totals = ["K", "R", "W", "X", "Y", "AD", "AG", "AI", "AK", "AL"].map((c) => ({ col: c, label: labels[c], file: sumF[c] ?? 0, portal: sumP[c] ?? 0 }));
  return { sheet, people, warnings, totals };
}
