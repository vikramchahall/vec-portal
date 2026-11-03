import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { calcSalary, roundUp, salarySettings, WS_COLUMNS } from "./salary";

const OCT = salarySettings(31);

describe("Working Salary formulas (BRD-01 3.8)", () => {
  it("ROUNDUP like Excel, including values that are whole numbers in Excel", () => {
    expect(roundUp(19978.06)).toBe(19979);
    expect(roundUp((21100 / 31) * 31)).toBe(21100);
    expect(roundUp(0)).toBe(0);
  });
  it("helper, full month, ESIC member", () => {
    const l = calcSalary({ structure: { basicDa: 14690, hra: 0, special: 0, conveyance: 0 }, payableDays: 31, lopDays: 0, hpDays: 0, pf: true, esi: true, bonusMonthly: true }, OCT);
    expect(l).toMatchObject({ gross: 14690, pf: 1763, bonus: 1224, esi: 120, lwf: 5, net: 14026, pt: 0 });
  });
  it("skilled with HRA: PF on gross − HRA, no ESIC above ₹21,000, PT ₹200, HP day paid at gross ÷ 26", () => {
    const l = calcSalary({ structure: { basicDa: 20644, hra: 3000, special: 0, conveyance: 0 }, payableDays: 30, lopDays: 1, hpDays: 1, pf: true, esi: false, bonusMonthly: true }, OCT);
    expect(l).toMatchObject({ earnedBasicDa: 19979, earnedHra: 2904, hpAmount: 910, pf: 2398, esi: 0, pt: 200 });
    expect(l.netAfterPt).toBe(l.totalEarning - l.pf - 5 + l.bonus - 200);
  });
  it("PF capped at the ₹25,000 ceiling", () => {
    expect(calcSalary({ structure: { basicDa: 30000, hra: 0, special: 0, conveyance: 0 }, payableDays: 31, lopDays: 0, hpDays: 0, pf: true, esi: false, bonusMonthly: true }, OCT).pf).toBe(3000);
  });
});

// October-2026 parity with the issued Working Salary sheets (private data: VEC_GOLDEN_DIR).
const G = process.env.VEC_GOLDEN_DIR;
type Gold = Record<string, { params: Record<string, unknown>; header: Record<string, string>; people: Record<string, Record<string, number>> }>;
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
describe.skipIf(!G || !existsSync(`${G}/oct_salary.json`))("October 2026 golden test", () => {
  it("every Working Salary column matches for every person (from the sheet's days and structure)", () => {
    const gold = JSON.parse(readFileSync(`${G}/oct_salary.json`, "utf8")) as Gold;
    const bad: string[] = [];
    let people = 0;
    for (const [unit, g] of Object.entries(gold)) for (const [card, v] of Object.entries(g.people)) {
      people++;
      const driver = unit.startsWith("DRIVERS");
      // the full-month block starts at the second "Basic + DA" header (AN, or AM in ETP-REF); flags sit 15 columns on
      const base = colNum(Object.entries(g.header).filter(([, h]) => h === "Basic + DA").map(([c]) => c).sort((a, b) => colNum(a) - colNum(b))[1]);
      const at = (k: number) => v[colName(base + k)] ?? 0;
      // staff sheets: flags PF, ESI, bonus; driver sheets: ESI, PF, bonus
      const pf = Boolean(driver ? at(16) : at(15)), esi = Boolean(driver ? at(15) : at(16)), bonus = Boolean(at(17));
      const l = calcSalary({ structure: { basicDa: at(0), da: at(1), hra: at(2), special: at(3), conveyance: at(4) },
        payableDays: v.K, lopDays: v.L, hpDays: v.T ?? 0, otDays: v.S ?? 0, pf, esi, bonusMonthly: bonus, annualBonus: !driver, hold: v.AJ ?? 0, leaveEncashment: v.AF ?? 0 }, OCT);
      const diffs = WS_COLUMNS.filter(([c, f]) => v[c] !== undefined && Math.abs(f(l) - v[c]) > 0.001).map(([c, f]) => `${c} ${f(l)}≠${v[c]}`);
      if (diffs.length) bad.push(`${unit} ${card}: ${diffs.join(", ")}`);
    }
    expect(bad.slice(0, 10), `${bad.length} of ${people} people differ`).toEqual([]);
  });
});
