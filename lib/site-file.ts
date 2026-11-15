import * as XLSX from "xlsx";

/**
 * Site Working Salary workbooks (STP, HZL Chanderiya, HZL Debari — MBD-01 S8). Their rules differ by site
 * (night allowance, benevolent fund, PF arrear, no PT in Rajasthan) and the team moves columns between months,
 * so nothing is read by letter: the first block of the "Working Salary" sheet (the month's earned amounts, up to
 * the second "Basic" column where the full-month structure starts) is read by its header text, and the day codes
 * come from "Attendance Format" (day numbers 1, 2, 3 … across, the person's code in column A).
 */
export type Amount = [string, number];
export type SiteRow = {
  code: string; name: string; designation: string | null; category: string | null; doj: string | null;
  days: number; lop: number; codes: string[] | null;
  earnings: Amount[]; gross: number; totalEarning: number; fixedGross: number;
  deductions: Amount[]; pfEE: number; esiEE: number; pt: number; lwfEE: number;
  pfER: number; esiER: number; lwfER: number; employerOther: number; bonus: number;
  net: number; hold: number; ctc: number; ctcBilling: number;
  /** from the site's Master Sheet (onboarding layout), when the person is there */
  info?: { dob?: string; fatherName?: string; gender?: string; esicIp?: string; uan?: string; pfAccount?: string; bankName?: string; account?: string; ifsc?: string };
};
export type SiteParse = { sheet: string; days: number; rows: SiteRow[]; warnings: string[] };

type Grid = unknown[][];
const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,₹\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const text = (v: unknown) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s || null; };
const pretty = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase())
  .replace(/\b(Ot|Hp|Pf|Da|Hra|Esic?)\b/g, (w) => (w.startsWith("Esi") ? "ESIC" : w.toUpperCase())).replace(/^Wf Rs-5$/, "Labour Welfare Fund").replace(/^PT$/, "Professional Tax");

function isoDate(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(String(v ?? "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Normalised day code: the sites write W/O, O or WO for a weekly off, A for absent, NP for a night shift present. */
export function siteCode(c: string): string {
  const s = c.trim().toUpperCase().replace(/\s/g, "");
  if (["WO", "W/O", "O", "WOH"].includes(s)) return "WO";
  if (s === "A" || s === "AB") return "X";
  if (s === "CO" || s === "C/O") return "CL";
  if (s === "PH") return "HP";
  return s;
}

export function parseSiteWorkbook(buf: ArrayBuffer | Buffer): SiteParse {
  const wb = XLSX.read(buf, { type: Buffer.isBuffer(buf) ? "buffer" : "array", cellDates: false });
  const sheet = wb.SheetNames.find((n) => /^working\s*salary/i.test(n.trim()) && !/20(1|2[0-5])\b/.test(n));
  if (!sheet) throw new Error('No "Working Salary" sheet for this month in the file.');
  const g = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
  let h = -1;
  for (let r = 0; r < 12 && h < 0; r++) if ((g[r] ?? []).some((v) => norm(v) === "name")) h = r;
  if (h < 0) throw new Error(`No header row with "Name" in "${sheet}".`);
  const width = Math.max((g[h] ?? []).length, (g[h + 1] ?? []).length);
  // label of each column: the header, or the merged group above + the sub-header (e.g. "employee contribution / pf 12%")
  const labels: string[] = [];
  let group = "";
  for (let c = 0; c < width; c++) {
    const top = text(g[h]?.[c]), sub = text(g[h + 1]?.[c]);
    if (top) group = top;
    labels[c] = norm(top ?? (sub ? `${group} / ${sub}` : ""));
    if (top && sub) labels[c] = norm(`${top} / ${sub}`);
  }
  const at = (test: (l: string) => boolean, from = 0, to = width) => { for (let c = from; c < to; c++) if (labels[c] && test(labels[c])) return c; return -1; };
  const name = at((l) => l === "name");
  const days = at((l) => l.startsWith("no.of days") || l.startsWith("no. of days") || l.startsWith("days payable"));
  const lop = at((l) => l === "lop");
  const firstBasic = at((l) => l === "basic" || l === "basic + da", days + 1);
  const end = at((l) => l === "basic" || l === "basic + da", firstBasic + 1); // the full-month block starts here
  const stop = end > 0 ? end : width;
  const grossC = at((l) => l.endsWith("gross salary") || l === "gross", firstBasic, stop);
  if (name < 0 || days < 0 || firstBasic < 0 || grossC < 0) throw new Error(`"${sheet}": Name, days, Basic or Gross column not found.`);
  const totalC = at((l) => l === "total earning", grossC, stop);
  const netC = at((l) => l.includes("net salary") || l.includes("net payable"), grossC, stop);
  const holdC = at((l) => l.startsWith("hold"), grossC, stop);
  const ctcC = at((l) => l === "ctc", grossC, stop);
  const billC = at((l) => l.startsWith("ctc for"), grossC, stop);
  const bonusC = at((l) => l.includes("monthly bonus"), grossC, stop);
  const fixedC = end > 0 ? at((l) => l === "gross" || l.endsWith("gross salary"), end, width) : -1;
  if (totalC < 0 || netC < 0) throw new Error(`"${sheet}": Total Earning or Net Salary column not found.`);

  // what each column between Total Earning and Net is: employee deduction, employer cost, or bonus
  type Kind = "pfEE" | "esiEE" | "pt" | "lwfEE" | "ded" | "pfER" | "esiER" | "lwfER" | "er" | "bonus" | "skip";
  const kinds = new Map<number, Kind>();
  let side: "ee" | "er" = "ee";
  for (let c = totalC + 1; c < netC; c++) {
    const l = labels[c];
    if (!l) continue;
    if (l.startsWith("employers contribution") || l.startsWith("employer")) side = "er";
    if (l.includes("monthly bonus")) { kinds.set(c, "bonus"); continue; }
    if (l.includes("annual bonus") || l.includes("leave encashment")) { kinds.set(c, "skip"); continue; }
    if (/er share|employer/.test(l) && l.includes("arrear")) { kinds.set(c, "er"); continue; }
    if (l.includes("13%")) { kinds.set(c, "pfER"); side = "er"; continue; }
    if (l.includes("3.25%")) { kinds.set(c, "esiER"); continue; }
    if (l.includes("rs-20")) { kinds.set(c, "lwfER"); continue; }
    if (l.includes("12%")) { kinds.set(c, "pfEE"); continue; }
    if (l.includes("0.75%")) { kinds.set(c, "esiEE"); continue; }
    if (l.includes("rs-5")) { kinds.set(c, "lwfEE"); continue; }
    if (/(^|\/ )pt$|professional tax/.test(l)) { kinds.set(c, "pt"); continue; }
    kinds.set(c, side === "er" ? "er" : "ded");
  }
  // earnings: the columns from Basic up to Gross, then OT / HP / night allowance up to Total Earning
  const amountCols = (from: number, to: number) => { const out: number[] = []; for (let c = from; c < to; c++) if (labels[c] && !/^(ot|pf?h ?o\.?t\.?|hw ot|np|ph o\.t\.)$/.test(labels[c])) out.push(c); return out; };
  const earnCols = [...amountCols(firstBasic, grossC), ...amountCols(grossC + 1, totalC).filter((c) => /amount|allo|arrear|incentive/.test(labels[c]))];

  // day codes from Attendance Format, by the code in column A
  const codesBy = new Map<string, string[]>();
  let monthDays = 0;
  const afName = wb.SheetNames.find((n) => /^attendance format/i.test(n.trim()));
  if (afName) {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[afName], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
    for (let r = 0; r < 12 && !monthDays; r++) {
      const row = a[r] ?? [];
      const d1 = row.findIndex((v, i) => num(v) === 1 && num(row[i + 1]) === 2 && num(row[i + 2]) === 3);
      if (d1 < 0) continue;
      while (num(row[d1 + monthDays]) === monthDays + 1 && monthDays < 31) monthDays++;
      for (let k = r + 1; k < a.length; k++) {
        const code = text(a[k]?.[0]);
        if (!code || /total/i.test(code)) continue;
        const cs = Array.from({ length: monthDays }, (_, i) => text(a[k]?.[d1 + i]) ?? "");
        if (cs.some((x) => x && !/^(mon|tue|wed|thu|fri|sat|sun)$/i.test(x))) codesBy.set(code.toUpperCase(), cs.map((x) => (x ? siteCode(x) : "")));
      }
    }
  }

  const master = readMaster(wb);
  const warnings: string[] = [];
  const rows: SiteRow[] = [];
  for (let r = h + 2; r < g.length; r++) {
    const row = g[r] ?? [];
    const nm = text(row[name]);
    const code = text(row[0]);
    if (!nm || /^total/i.test(nm) || /^(prepared|checked|approved)/i.test(nm)) continue;
    if (!num(row[totalC]) && !num(row[netC]) && !num(row[days])) continue;
    const earnings: Amount[] = earnCols.map((c) => [pretty(labels[c].replace(/^total /, "").replace(/ amount$/, "")), Math.round(num(row[c]))] as Amount).filter(([, v]) => v !== 0);
    const sumOf = (k: Kind) => [...kinds].filter(([, kk]) => kk === k).reduce((s, [c]) => s + num(row[c]), 0);
    const deductions: Amount[] = [];
    for (const [c, k] of kinds) if (["pfEE", "esiEE", "pt", "lwfEE", "ded"].includes(k) && num(row[c])) deductions.push([pretty(labels[c].split(" / ").pop()!.replace(/^employee contribution$/, "deduction")), Math.round(num(row[c]))]);
    const hold = holdC >= 0 ? num(row[holdC]) : 0;
    if (hold) deductions.push(["Hold", Math.round(hold)]);
    const item: SiteRow = {
      code: code ?? "", name: nm.toUpperCase(),
      designation: text(row[at((l) => l === "designation")])?.toUpperCase() ?? null,
      category: text(row[at((l) => l === "category" || l === "grade")])?.toUpperCase() ?? null,
      doj: isoDate(row[at((l) => l.includes("joining") || l === "doj" || l === "d.o.j.")]),
      days: num(row[days]), lop: lop >= 0 ? num(row[lop]) : 0, codes: codesBy.get((code ?? "").toUpperCase()) ?? null,
      earnings, gross: Math.round(num(row[grossC])), totalEarning: Math.round(num(row[totalC])), fixedGross: fixedC >= 0 ? Math.round(num(row[fixedC])) : 0,
      deductions, pfEE: sumOf("pfEE"), esiEE: sumOf("esiEE"), pt: sumOf("pt"), lwfEE: sumOf("lwfEE"),
      pfER: sumOf("pfER"), esiER: sumOf("esiER"), lwfER: sumOf("lwfER"), employerOther: sumOf("er"), bonus: bonusC >= 0 ? num(row[bonusC]) : sumOf("bonus"),
      net: Math.round(num(row[netC])), hold: Math.round(hold), ctc: ctcC >= 0 ? Math.round(num(row[ctcC])) : 0, ctcBilling: billC >= 0 ? Math.round(num(row[billC])) : 0,
    };
    item.info = master.get((code ?? "").toUpperCase()) ?? master.get(`name:${item.name}`);
    // the site's own net must follow from its own columns (with or without the monthly bonus)
    const ded = item.deductions.reduce((s, [, v]) => s + v, 0);
    const a1 = item.totalEarning - ded, a2 = a1 + Math.round(item.bonus);
    if (Math.abs(a1 - item.net) > 2 && Math.abs(a2 - item.net) > 2) warnings.push(`${item.name}: net ₹${item.net} does not equal total earning − deductions (₹${a1}${item.bonus ? ` or ₹${a2} with bonus` : ""}) — check the row's formula.`);
    if (!item.codes && codesBy.size) warnings.push(`${item.name} (${code ?? "no code"}): no row in Attendance Format.`);
    rows.push(item);
  }
  if (!rows.length) throw new Error(`"${sheet}": no employee rows found.`);
  if (!codesBy.size) warnings.push("No Attendance Format sheet with day codes — the worker page will show totals only.");
  const noCode = rows.filter((x) => !x.code || /^new/i.test(x.code));
  if (noCode.length) warnings.push(`${noCode.length} without a gate pass / employee code (${noCode.map((x) => x.name).join(", ")}) — kept under a NEW-… code.`);
  return { sheet, days: monthDays, rows, warnings };
}

/** The site's Master Sheet (HZL onboarding layout: EMPLOYEE CODE, EMPLOYEE NAME, DATE OF BIRTH, ESI NUMBER, UAN, BANK …), by code and by name. */
function readMaster(wb: XLSX.WorkBook) {
  const out = new Map<string, NonNullable<SiteRow["info"]>>();
  const ms = wb.SheetNames.find((n) => /^master( sheet)?$/i.test(n.trim()));
  if (!ms) return out;
  const g = XLSX.utils.sheet_to_json(wb.Sheets[ms], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
  const h = g.findIndex((r, i) => i < 8 && (r ?? []).some((v) => norm(v).startsWith("employee code")) && (r ?? []).some((v) => norm(v).includes("name")));
  if (h < 0) return out;
  const col = (t: (l: string) => boolean) => (g[h] ?? []).findIndex((v) => t(norm(v)));
  const c = { code: col((l) => l.startsWith("employee code")), name: col((l) => l === "employee name" || l === "name"), dob: col((l) => l.startsWith("date of birth")),
    father: col((l) => l.startsWith("father")), gender: col((l) => l === "gender"), esi: col((l) => l.startsWith("esi n")), uanPf: col((l) => l.startsWith("uan /") || l.startsWith("uan/")),
    uan: col((l) => l.startsWith("uan no")), bank: col((l) => l === "bank name"), acc: col((l) => l.startsWith("bank account")), ifsc: col((l) => l.startsWith("ifsc")) };
  const val = (r: unknown[], i: number) => { if (i < 0) return undefined; const v = text(typeof r[i] === "number" ? String(Math.round(r[i] as number)) : r[i]); return v && !/^[-0]$/.test(v) ? v : undefined; };
  const digits = (v?: string) => (v && /^\d+$/.test(v.replace(/\s/g, "")) ? v.replace(/\s/g, "") : undefined);
  for (const r of g.slice(h + 1)) {
    if (!r) continue;
    const code = val(r, c.code), name = val(r, c.name);
    if (!code && !name) continue;
    const uanPf = val(r, c.uanPf);
    const info = {
      dob: c.dob >= 0 ? isoDate(r[c.dob]) ?? isoDateText(val(r, c.dob)) : undefined, fatherName: val(r, c.father)?.toUpperCase(), gender: val(r, c.gender),
      esicIp: digits(val(r, c.esi)), uan: digits(val(r, c.uan)) ?? (uanPf && /^\d{12}$/.test(uanPf) ? uanPf : undefined),
      pfAccount: uanPf && !/^\d{12}$/.test(uanPf) ? uanPf : undefined, bankName: val(r, c.bank)?.toUpperCase(), account: digits(val(r, c.acc)), ifsc: val(r, c.ifsc)?.toUpperCase(),
    };
    for (const k of Object.keys(info) as (keyof typeof info)[]) if (info[k] === undefined || info[k] === null) delete info[k];
    if (code) out.set(code.toUpperCase(), info as NonNullable<SiteRow["info"]>);
    if (name) out.set(`name:${name.toUpperCase()}`, info as NonNullable<SiteRow["info"]>);
  }
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "05-Oct-1983", "16-Sep.-2026" */
function isoDateText(v?: string) {
  const m = /^(\d{1,2})[-\s./]([A-Za-z]{3})[A-Za-z.]*[-\s./](\d{4})$/.exec(v ?? "");
  const mi = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined;
}
