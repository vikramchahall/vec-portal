import "server-only";
import { unitList } from "@/lib/employees";
import { monthSalary } from "@/lib/payroll";

/**
 * PF and ESIC for one establishment and month (MBD-01 S7). Units are filed together by the first part of
 * their code — ETP-PET + ETP-REF = "ETP", WB-PET + WB-REF = "WB", DRIVERS on its own — as in the Sep-26
 * "ESIC & EPFO Combined" workbooks. Amounts come from the Working Salary lines, so they always agree with it:
 *   EPF wages  = MIN(gross − HRA, PF ceiling)   (0 for non-members)
 *   EPS wages  = MIN(EPF wages, EPS ceiling)    (both ₹25,000 under the 2026 rule)
 *   EPS 8.33%  = ROUND(EPS wages × 8.33%);  EPF–EPS difference = employee 12% − EPS
 *   ESIC wages = total earning + monthly bonus (ESIC members with a contribution)
 */
export const groupOf = (unitCode: string) => unitCode.split("-")[0].toUpperCase();
export const EPS_CEILING = 25000;

export type StatRow = {
  unit: string; card: string; regNo: string | null; name: string; designation: string | null; category: string | null;
  uan: string | null; esicIp: string | null; pf: boolean; esi: boolean;
  days: number; lop: number; basicDa: number; gross: number; totalEarning: number;
  epfWages: number; epsWages: number; pfEE: number; pfER: number; eps: number; epfEpsDiff: number;
  esicWages: number; esiEE: number; esiER: number;
};
export type StatUnit = { code: string; name: string; status: string; people: number };
export type StatMonth = {
  group: string; year: number; month: number; days: number; units: StatUnit[]; rows: StatRow[]; warnings: string[];
  totals: Record<"pfEE" | "pfER" | "eps" | "epfEpsDiff" | "epfWages" | "esiEE" | "esiER" | "esicWages", number>;
};

export async function statutoryGroups() {
  const units = await unitList();
  const g = new Map<string, string[]>();
  for (const u of units.filter((x) => x.mode === "punch")) g.set(groupOf(u.code), [...(g.get(groupOf(u.code)) ?? []), u.code]);
  return [...g.entries()].map(([group, codes]) => ({ group, codes }));
}

export async function statutoryMonth(group: string, year: number, month: number): Promise<StatMonth | null> {
  const codes = (await statutoryGroups()).find((g) => g.group === group)?.codes;
  if (!codes) return null;
  const units: StatUnit[] = [], rows: StatRow[] = [], warnings: string[] = [];
  let days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (const code of codes) {
    const ms = await monthSalary(code, year, month);
    if (!ms) continue;
    days = ms.days;
    const lines = ms.rows.filter((r) => r.line);
    units.push({ code, name: ms.unit.name, status: ms.run.status, people: lines.length });
    if (ms.run.status !== "locked") warnings.push(`${code} ${ms.run.status === "approved" ? "is approved but not locked" : "is still a draft"} — figures can still change.`);
    const noStruct = ms.rows.filter((r) => r.problem).length;
    if (noStruct) warnings.push(`${code}: ${noStruct} without a pay structure are left out.`);
    const ceiling = ms.settings.pfCeiling;
    for (const r of lines) {
      const l = r.line!;
      const epfWages = r.pf && l.pf > 0 ? Math.min(l.gross - l.earnedHra, ceiling) : 0;
      const epsWages = Math.min(epfWages, EPS_CEILING);
      const eps = Math.round(epsWages * 0.0833);
      const esicWages = r.esi && l.esi > 0 ? l.totalEarning + l.bonus : 0;
      rows.push({
        unit: code, card: r.p.card, regNo: r.regNo, name: r.p.name, designation: r.p.designation ?? null, category: r.category,
        uan: r.uan, esicIp: r.esicIp, pf: epfWages > 0, esi: esicWages > 0,
        days: l.payableDays, lop: l.lop, basicDa: l.earnedBasicDa + l.earnedDa, gross: l.gross, totalEarning: l.totalEarning,
        epfWages, epsWages, pfEE: l.pf, pfER: l.pfEmployer, eps, epfEpsDiff: epfWages ? l.pf - eps : 0,
        esicWages, esiEE: l.esi, esiER: l.esiEmployer,
      });
    }
  }
  const noUan = rows.filter((r) => r.pf && !r.uan);
  if (noUan.length) warnings.push(`${noUan.length} PF member${noUan.length > 1 ? "s have" : " has"} no UAN and cannot go in the ECR: ${noUan.map((r) => r.name).join(", ")}.`);
  const noIp = rows.filter((r) => r.esi && !r.esicIp);
  if (noIp.length) warnings.push(`${noIp.length} ESIC member${noIp.length > 1 ? "s have" : " has"} no ESIC IP number: ${noIp.map((r) => r.name).join(", ")}.`);
  const sum = (k: keyof StatMonth["totals"]) => rows.reduce((s, r) => s + r[k], 0);
  const totals = { pfEE: sum("pfEE"), pfER: sum("pfER"), eps: sum("eps"), epfEpsDiff: sum("epfEpsDiff"), epfWages: sum("epfWages"), esiEE: sum("esiEE"), esiER: sum("esiER"), esicWages: sum("esicWages") };
  return { group, year, month, days, units, rows, warnings, totals };
}

/** EPFO ECR 2.0 text: UAN#~#Name#~#Gross#~#EPF#~#EPS#~#EDLI wages#~#EE#~#EPS#~#EPF-EPS diff#~#NCP days#~#Refund */
export function ecrText(s: StatMonth) {
  return s.rows.filter((r) => r.pf && r.uan)
    .map((r) => [r.uan, r.name.replace(/[^A-Za-z .]/g, " ").replace(/\s+/g, " ").trim(), r.totalEarning, r.epfWages, r.epsWages, r.epsWages, r.pfEE, r.eps, r.epfEpsDiff, r.lop, 0].join("#~#"))
    .join("\r\n") + "\r\n";
}
