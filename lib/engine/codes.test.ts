import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { coverAndBalances, weeklyOffCodes, type Code } from "./codes";

// October 2026: 1st is a Thursday; Sundays are 4, 11, 18, 25; holidays 2 and 20.
const OCT = { year: 2026, month: 10, days: 31, holidays: [2, 20] };
const worked = (except: number[]) => new Set([...Array(31)].map((_, i) => i + 1).filter((d) => !except.includes(d)));

describe("weekly-off rule (BRD-01 3.6)", () => {
  it("gives WO on the usual weekday and holidays as H / HP", () => {
    const c = weeklyOffCodes({ ...OCT, woWeekday: "Sun", worked: worked([2, 4, 11, 18, 25]) });
    expect([c[1], c[3], c[10], c[19]]).toEqual(["H", "WO", "WO", "HP"]);
  });
  it("moves the WO to the next no-duty day when the person worked on the due day", () => {
    const c = weeklyOffCodes({ ...OCT, woWeekday: "Sun", worked: worked([5, 11, 18, 25]) });
    expect(c[3]).toBe("P");  // worked on Sunday 4th
    expect(c[4]).toBe("WO"); // no duty Monday 5th -> WO, next due 12th
    expect(c[10]).toBe("X"); // Sunday 11th is before the next due day
  });
  it("gives no WO after the last duty for someone who left (no work in the last 7 days)", () => {
    const c = weeklyOffCodes({ ...OCT, woWeekday: "Sun", worked: new Set([1, 3, 5, 6, 7, 8, 9, 10]) });
    expect(c[17]).toBe("X"); // Sunday 18th after leaving
  });
  it("starts a new joiner on the joining day", () => {
    const c = weeklyOffCodes({ ...OCT, woWeekday: "Sun", joinedDay: 16, worked: new Set([16, 17, 19, 20, 21]) });
    expect(c.slice(0, 15).every((x) => x === "")).toBe(true);
    expect(c[17]).toBe("WO"); // Sunday 18th
    expect(c[19]).toBe("HP");
  });
  it("no duty in the whole month = X every day", () => {
    expect(new Set(weeklyOffCodes({ ...OCT, woWeekday: "Sun", worked: new Set() }))).toEqual(new Set(["X"]));
  });
});

describe("L / CL cover and balances (BRD-01 3.7)", () => {
  const raw = (xs: number[]): Code[] => [...Array(31)].map((_, i) => (xs.includes(i + 1) ? "X" : "P"));
  it("covers X with whole days of L first, then CL, the rest stay X", () => {
    const b = coverAndBalances(raw([5, 9, 13, 17]), [], { l: 1.9, cl: 1 });
    // L available = floor(1.9 + 27 × 0.064) = floor(3.628) = 3; CL available = 1
    expect([b.final[4], b.final[8], b.final[12], b.final[16]]).toEqual(["L", "L", "L", "CL"]);
    expect(b.counts).toMatchObject({ P: 27, L: 3, CL: 1, X: 0, payable: 31 });
  });
  it("credits CL from C-Off: (excess × 2 + less) ÷ 8", () => {
    const coff = Array(31).fill(0); coff[0] = 4; coff[1] = -1;
    const b = coverAndBalances(raw([]), coff, { l: 0, cl: 0 });
    expect(b.coff).toEqual({ excess: 4, less: -1, clHours: 7, totalCl: 0.875 });
    expect(b.close.cl).toBe(0.875);
  });
  it("does not cover absences when cover is off (drivers)", () => {
    expect(coverAndBalances(raw([5]), [], { l: 5, cl: 5 }, { lPerWorkedDay: 0.064, excessFactor: 2, clHoursPerDay: 8, cover: false }).final[4]).toBe("X");
  });
});

// October-2026 parity with the issued Working Salary files (private data, run locally with VEC_GOLDEN_DIR).
const G = process.env.VEC_GOLDEN_DIR;
type GoldPerson = { final: Code[]; raw: Code[] | null; counts: Record<string, number>; bf: { cl: number; l: number }; credit: { cl: number; l: number }; used: { cl: number; l: number }; close: { cl: number; l: number }; wo: string; coff: number[] | null };
describe.skipIf(!G || !existsSync(`${G}/oct_codes.json`))("October 2026 golden test", () => {
  const gold = G ? (JSON.parse(readFileSync(`${G}/oct_codes.json`, "utf8")) as Record<string, Record<string, GoldPerson>>) : {};
  const duties = G ? (JSON.parse(readFileSync(`${G}/oct_duties.json`, "utf8")) as Record<string, Record<string, Record<string, unknown>>>) : {};
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  it("cover and balances match the Attendance Format for every person (from the sheet's raw codes)", () => {
    const bad: string[] = [];
    for (const [u, people] of Object.entries(gold)) for (const [card, g] of Object.entries(people)) {
      if (!g.raw || !g.coff) continue;
      const b = coverAndBalances(g.raw, g.coff, { cl: Number(g.bf.cl) || 0, l: Number(g.bf.l) || 0 });
      const ok = JSON.stringify(b.final) === JSON.stringify(g.final) && b.counts.payable === g.counts.pay
        && close(b.close.cl, g.close.cl) && close(b.close.l, g.close.l) && close(b.credit.l, g.credit.l) && close(b.credit.cl, g.credit.cl);
      if (!ok) bad.push(`${u} ${card}`);
    }
    expect(bad).toEqual([]);
  });

  it("weekly-off rule gives the sheet's raw codes except where the office typed a code by hand", () => {
    let same = 0; const differ: string[] = [];
    for (const [u, people] of Object.entries(gold)) for (const [card, g] of Object.entries(people)) {
      if (!g.raw) continue;
      const days = new Set<number>();
      for (const byWo of Object.values(duties)) for (const d of Object.keys(byWo[card] ?? {})) days.add(Number(d));
      // the two REF M&I helpers' 29-Oct card issue was taken out by hand
      if (["46867257", "46867258"].includes(card)) days.delete(29);
      const first = g.raw.findIndex((c) => c !== "");
      const raw = weeklyOffCodes({ ...OCT, woWeekday: g.wo, joinedDay: first > 0 ? first + 1 : null, worked: days });
      const diffDays = raw.map((c, i) => (c !== g.raw![i] ? `${i + 1}:${c}->${g.raw![i]}` : "")).filter(Boolean);
      if (diffDays.length) differ.push(`${u} ${card} ${diffDays.join(",")}`); else same++;
    }
    console.log(`weekly-off rule: ${same} people identical, ${differ.length} with hand-typed codes`);
    differ.forEach((d) => console.log("  ", d));
    expect(same).toBeGreaterThan(0.9 * (same + differ.length));
  });
});
