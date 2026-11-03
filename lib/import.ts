/**
 * Reads employees out of the monthly salary workbooks VEC already makes
 * (Working_Salary_<UNIT>_<Mon>-<YYYY>.xlsx, staff and driver versions) or out of
 * the portal's own "VEC Employees" template (for STP, HZL and anyone else).
 *
 * Columns are found by their header text, never by position: the staff and driver
 * files put the same columns in different places, and teams insert columns.
 */
import * as XLSX from "xlsx";

export type ImportRow = {
  cardNo: string; name: string; unitCode?: string; registerNo?: string; designation?: string; category?: string;
  doj?: string; woWeekday?: string; isDriver?: boolean;
  basicDa?: number; hra?: number; special?: number; conveyance?: number; others?: number;
  pfMember?: boolean; esiMember?: boolean; bonusMonthly?: boolean;
  uan?: string; pfAccount?: string; esicIp?: string; bankName?: string; account?: string; ifsc?: string;
  fatherName?: string; dob?: string; gender?: string; mobile?: string; aadhaar?: string; pan?: string;
  leave?: { clBf: number; lBf: number; clClose: number; lClose: number }; // from the Attendance Format sheet
};
export type ParseResult = { kind: "salary-workbook" | "template"; rows: ImportRow[]; warnings: string[]; sheets: string[] };

export const TEMPLATE_SHEET = "VEC Employees";
export const TEMPLATE_COLUMNS: [keyof ImportRow, string][] = [
  ["cardNo", "Card / employee code"], ["name", "Name"], ["unitCode", "Unit"], ["registerNo", "Register no"], ["designation", "Designation"],
  ["category", "Category"], ["doj", "Date of joining"], ["woWeekday", "Weekly off"], ["basicDa", "Basic + DA"], ["hra", "HRA"],
  ["special", "Special allowance"], ["conveyance", "Conveyance"], ["others", "Others"], ["pfMember", "PF member (Y/N)"],
  ["esiMember", "ESIC member (Y/N)"], ["bonusMonthly", "Monthly bonus (Y/N)"], ["uan", "UAN"], ["pfAccount", "PF account no"],
  ["esicIp", "ESIC IP no"], ["bankName", "Bank"], ["account", "Account no"], ["ifsc", "IFSC"], ["fatherName", "Father's name"],
  ["dob", "Date of birth"], ["gender", "Gender"], ["mobile", "Mobile"], ["aadhaar", "Aadhaar"], ["pan", "PAN"],
];

type Grid = unknown[][];
const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const text = (v: unknown) => { const s = String(v ?? "").trim(); return s === "" ? undefined : s; };
const money = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,₹\s]/g, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.round(n) : undefined; };
const yes = (v: unknown) => { const s = norm(v); return s === "" ? undefined : ["y", "yes", "1", "true"].includes(s); };
const digits = (v: unknown) => { const s = String(v ?? "").replace(/\s/g, ""); return /^\d+$/.test(s) ? s : undefined; };

/** 12.04.2023, 12-04-2023, 2023-04-12 or an Excel serial -> 2023-04-12 */
export function toIsoDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

const cardOf = (v: unknown) => {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return String(v);
  const s = String(v ?? "").trim();
  return /^[A-Za-z0-9-]{3,20}$/.test(s) && /\d/.test(s) ? s : undefined;
};

function grid(wb: XLSX.WorkBook, name: string): Grid {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
}

/** Row index of the header that contains all the given labels (first 10 rows). */
function headerRow(g: Grid, labels: string[]) {
  for (let r = 0; r < Math.min(10, g.length); r++) {
    const cells = (g[r] ?? []).map(norm);
    if (labels.every((l) => cells.some((c) => c === l || c.startsWith(l)))) return r;
  }
  return -1;
}

/** Column indexes whose header (in any of the rows) matches; in left-to-right order. */
function cols(g: Grid, rows: number[], test: (h: string) => boolean) {
  const out: number[] = [];
  const width = Math.max(...rows.map((r) => (g[r] ?? []).length));
  for (let c = 0; c < width; c++) if (rows.some((r) => test(norm(g[r]?.[c])))) out.push(c);
  return out;
}

function parseSalaryWorkbook(wb: XLSX.WorkBook, warnings: string[]): ImportRow[] {
  const wsName = wb.SheetNames.find((n) => /^working salary/i.test(n.trim()));
  if (!wsName) throw new Error('No sheet starting with "Working Salary" in this file.');
  const g = grid(wb, wsName);
  const h = headerRow(g, ["name", "designation"]);
  if (h < 0) throw new Error(`Could not find the header row (Name, Designation) in "${wsName}".`);
  const first = (t: (s: string) => boolean) => cols(g, [h], t)[0];
  // salary sheets repeat each column twice: the month's earned amount, then the full-month structure
  const second = (rowsToSearch: number[], t: (s: string) => boolean) => cols(g, rowsToSearch, t)[1];
  const c = {
    reg: first((s) => s === "register no." || s === "emp. no." || s === "register no"),
    name: first((s) => s === "name"),
    desig: first((s) => s === "designation"),
    cat: first((s) => s === "category" || s === "grade"),
    doj: first((s) => s.includes("joining") || s === "d.o.j."),
    // the full-month structure is the second "Basic + DA" group (the first is the month's earned amount)
    basic: second([h], (s) => s === "basic + da"),
    hra: second([h], (s) => s === "hra"),
    special: second([h], (s) => s === "special allowance"),
    conv: second([h], (s) => s === "conveyance allowance"),
    pf: second([h + 1], (s) => s.startsWith("pf") && s.includes("12%")),
    esi: second([h + 1], (s) => s.startsWith("esic") && s.includes("0.75%")),
    bonus: second([h], (s) => s === "monthly bonus"),
  };
  if (c.name === undefined) throw new Error("Name column not found.");
  if (c.basic === undefined) warnings.push(`"${wsName}": full-month Basic + DA column not found — pay structures will not be imported.`);

  const rows: ImportRow[] = [];
  for (let r = h + 2; r < g.length; r++) {
    const row = g[r] ?? [];
    const card = cardOf(row[0]);
    const name = text(row[c.name]);
    if (!card || !name || /^total/i.test(name)) continue;
    const designation = c.desig !== undefined ? text(row[c.desig])?.toUpperCase() : undefined;
    rows.push({
      cardNo: card, name: name.toUpperCase(),
      registerNo: c.reg !== undefined ? text(row[c.reg]) : undefined,
      designation, category: c.cat !== undefined ? text(row[c.cat])?.toUpperCase().replace("HIGHLY SKILLED", "HIGH SKILLED") : undefined,
      doj: c.doj !== undefined ? toIsoDate(row[c.doj]) : undefined,
      isDriver: designation === "DRIVER",
      basicDa: c.basic !== undefined ? money(row[c.basic]) : undefined,
      hra: c.hra !== undefined ? money(row[c.hra]) ?? 0 : undefined,
      special: c.special !== undefined ? money(row[c.special]) ?? 0 : undefined,
      conveyance: c.conv !== undefined ? money(row[c.conv]) ?? 0 : undefined,
      pfMember: c.pf !== undefined ? (money(row[c.pf]) ?? 0) > 0 : undefined,
      esiMember: c.esi !== undefined ? (money(row[c.esi]) ?? 0) > 0 : undefined,
      bonusMonthly: c.bonus !== undefined ? (money(row[c.bonus]) ?? 0) > 0 : undefined,
    });
  }
  const byCard = new Map(rows.map((x) => [x.cardNo, x]));

  // Master Sheet: bank, UAN, ESI number
  const msName = wb.SheetNames.find((n) => /^master( sheet)?$/i.test(n.trim()));
  if (msName) {
    const m = grid(wb, msName);
    const mh = headerRow(m, ["employee code"]);
    if (mh >= 0) {
      const at = (t: (s: string) => boolean) => cols(m, [mh], t)[0];
      const k = { code: at((s) => s === "employee code"), esi: at((s) => s.startsWith("esi")), pfa: at((s) => s.startsWith("pf account")),
        bank: at((s) => s === "bank name"), acc: at((s) => s.startsWith("bank account")), ifsc: at((s) => s.startsWith("ifsc")), uan: at((s) => s.startsWith("uan")) };
      let matched = 0;
      for (let r = mh + 1; r < m.length; r++) {
        const row = m[r] ?? [];
        const x = byCard.get(cardOf(row[k.code]) ?? "");
        if (!x) continue;
        matched++;
        x.esicIp = k.esi !== undefined ? digits(row[k.esi]) : undefined; // "WCP" etc. are not ESIC numbers
        x.pfAccount = k.pfa !== undefined ? text(row[k.pfa]) : undefined;
        x.bankName = k.bank !== undefined ? text(row[k.bank])?.toUpperCase() : undefined;
        x.account = k.acc !== undefined ? digits(row[k.acc]) : undefined;
        x.ifsc = k.ifsc !== undefined ? text(row[k.ifsc])?.toUpperCase() : undefined;
        x.uan = k.uan !== undefined ? digits(row[k.uan]) : undefined;
      }
      if (matched < rows.length) warnings.push(`Master Sheet has bank / UAN for ${matched} of ${rows.length} employees.`);
    }
  } else warnings.push("No Master Sheet in this file — bank details and UAN are not imported.");

  // Attendance Format: usual weekly-off day
  const afName = wb.SheetNames.find((n) => /^attendance format/i.test(n.trim()));
  if (afName) {
    const a = grid(wb, afName);
    for (let r0 = 0; r0 < Math.min(8, a.length); r0++) {
      const wo = (a[r0] ?? []).findIndex((v) => norm(v).includes("weekly off"));
      if (wo < 0) continue;
      for (let r = r0 + 1; r < a.length; r++) {
        const x = byCard.get(cardOf(a[r]?.[0]) ?? "");
        const d = text(a[r]?.[wo]);
        if (x && d && /^(mon|tue|wed|thu|fri|sat|sun)$/i.test(d)) x.woWeekday = d[0].toUpperCase() + d.slice(1, 3).toLowerCase();
      }
      break;
    }
    // Leave balances: "B/F" = opening (CL, then L), "Balance" = closing (CL, then L) — next month's opening
    for (let r0 = 0; r0 < Math.min(8, a.length); r0++) {
      const cells = (a[r0] ?? []).map(norm);
      const bf = cells.findIndex((v) => v.startsWith("b/f"));
      const bal = cells.findIndex((v, i) => i > bf && v === "balance");
      if (bf < 0 || bal < 0) continue;
      const num = (v: unknown) => (typeof v === "number" ? v : v === null || v === "" ? 0 : Number(v));
      for (let r = r0 + 1; r < a.length; r++) {
        const x = byCard.get(cardOf(a[r]?.[0]) ?? "");
        if (!x) continue;
        const row = a[r] ?? [];
        if ([bf, bf + 1, bal, bal + 1].some((c) => Number.isNaN(num(row[c])))) continue;
        x.leave = { clBf: num(row[bf]), lBf: num(row[bf + 1]), clClose: num(row[bal]), lClose: num(row[bal + 1]) };
      }
      break;
    }
  }
  return rows;
}

function parseTemplate(wb: XLSX.WorkBook, warnings: string[]): ImportRow[] {
  const g = grid(wb, TEMPLATE_SHEET);
  const h = headerRow(g, ["card / employee code", "name"]);
  if (h < 0) throw new Error(`"${TEMPLATE_SHEET}" sheet has no header row — download a fresh template.`);
  const idx = new Map(TEMPLATE_COLUMNS.map(([k, label]) => [k, (g[h] ?? []).findIndex((v) => norm(v) === norm(label))]));
  const rows: ImportRow[] = [];
  for (let r = h + 1; r < g.length; r++) {
    const row = g[r] ?? [];
    const get = (k: keyof ImportRow) => { const i = idx.get(k) ?? -1; return i >= 0 ? row[i] : undefined; };
    const card = cardOf(get("cardNo")), name = text(get("name"));
    if (!card && !name) continue;
    if (!card || !name) { warnings.push(`Row ${r + 1}: card and name are both needed — skipped.`); continue; }
    rows.push({
      cardNo: card, name: name.toUpperCase(), unitCode: text(get("unitCode"))?.toUpperCase(), registerNo: text(get("registerNo")),
      designation: text(get("designation"))?.toUpperCase(), category: text(get("category"))?.toUpperCase(), doj: toIsoDate(get("doj")),
      woWeekday: text(get("woWeekday"))?.slice(0, 3), basicDa: money(get("basicDa")), hra: money(get("hra")), special: money(get("special")),
      conveyance: money(get("conveyance")), others: money(get("others")), pfMember: yes(get("pfMember")), esiMember: yes(get("esiMember")),
      bonusMonthly: yes(get("bonusMonthly")), uan: digits(get("uan")), pfAccount: text(get("pfAccount")), esicIp: digits(get("esicIp")),
      bankName: text(get("bankName"))?.toUpperCase(), account: digits(get("account")), ifsc: text(get("ifsc"))?.toUpperCase(),
      fatherName: text(get("fatherName"))?.toUpperCase(), dob: toIsoDate(get("dob")), gender: text(get("gender")), mobile: text(get("mobile")),
      aadhaar: digits(get("aadhaar")), pan: text(get("pan"))?.toUpperCase(),
    });
    const last = rows[rows.length - 1];
    last.isDriver = last.designation === "DRIVER";
  }
  return rows;
}

export function parseWorkbook(buf: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false, cellFormula: false, cellStyles: false });
  const warnings: string[] = [];
  const kind = wb.SheetNames.includes(TEMPLATE_SHEET) ? "template" : "salary-workbook";
  const rows = kind === "template" ? parseTemplate(wb, warnings) : parseSalaryWorkbook(wb, warnings);
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.cardNo)) warnings.push(`Card ${r.cardNo} appears more than once — the last row wins.`);
    seen.add(r.cardNo);
  }
  return { kind, rows, warnings, sheets: wb.SheetNames };
}

/** Empty "VEC Employees" template with one example row. */
export function templateWorkbook(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS.map(([, l]) => l),
    ["46860001", "SAMPLE NAME", "STP", "1", "OPERATOR", "SEMI SKILLED", "01-10-2026", "Sun", 17186, 0, 0, 0, 0, "Y", "Y", "Y", "", "", "", "STATE BANK OF INDIA", "", "SBIN0001234", "", "", "", "", "", ""],
  ]);
  ws["!cols"] = TEMPLATE_COLUMNS.map(([, l]) => ({ wch: Math.max(12, l.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
