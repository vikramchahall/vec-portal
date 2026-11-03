import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { buildDuties, clock, type Punch } from "./duty";
import { parsePunchWorkbook } from "../punches";

const P = (ts: string, dir: "Entry" | "Exit", access = "Access Granted"): Punch => ({ ts, dir, access });
const one = (ps: Punch[]) => buildDuties(ps, 2026, 10);

describe("duty rules (BRD-01 3.3–3.5)", () => {
  it("A shift, extra time after the first 0:30 counted in half hours", () => {
    const [d] = one([P("2026-10-05 05:52:00", "Entry"), P("2026-10-05 16:12:00", "Exit")]);
    expect(d).toMatchObject({ day: 5, shift: "A", late: 0, coff: 1 }); // 10:20 worked, 8:30 required: +1:50, less 0:30 = 1:20 -> +1:00
  });
  it("worked 10:20 on A shift gives +1:00 (example in the OT Justification sheet)", () => {
    const [d] = one([P("2026-10-06 06:00:00", "Entry"), P("2026-10-06 16:20:00", "Exit")]);
    expect(d.coff).toBe(1);
  });
  it("short by 1:20 gives −1:00; short by 0:30 gives 0", () => {
    expect(one([P("2026-10-07 06:00:00", "Entry"), P("2026-10-07 13:10:00", "Exit")])[0].coff).toBe(-1);
    expect(one([P("2026-10-08 06:00:00", "Entry"), P("2026-10-08 14:00:00", "Exit")])[0].coff).toBe(0);
  });
  it("12-hour duty gets +4, 13 hours +4.5, and is marked 12", () => {
    expect(one([P("2026-10-09 06:00:00", "Entry"), P("2026-10-09 17:10:00", "Exit")])[0]).toMatchObject({ coff: 4, shift: "A12" });
    expect(one([P("2026-10-10 06:00:00", "Entry"), P("2026-10-10 19:05:00", "Exit")])[0]).toMatchObject({ coff: 4.5 });
  });
  it("night shift belongs to the day it started; OUT shown with (+1)", () => {
    const [d] = one([P("2026-10-11 21:50:00", "Entry"), P("2026-10-12 07:00:00", "Exit")]);
    expect(d).toMatchObject({ day: 11, shift: "C" });
    expect(clock(d.out, "2026-10-11")).toBe("07:00 (+1)");
  });
  it("late beyond 15 minutes of grace is reported in minutes", () => {
    expect(one([P("2026-10-13 08:50:00", "Entry"), P("2026-10-13 17:30:00", "Exit")])[0]).toMatchObject({ shift: "G", late: 20 });
    expect(one([P("2026-10-14 08:44:00", "Entry"), P("2026-10-14 17:30:00", "Exit")])[0].late).toBe(0);
  });
  it("stepping out and back the same day is one duty", () => {
    const ds = one([P("2026-10-15 06:00:00", "Entry"), P("2026-10-15 10:00:00", "Exit"), P("2026-10-15 13:30:00", "Entry"), P("2026-10-15 15:00:00", "Exit")]);
    expect(ds).toHaveLength(1);
    expect(ds[0].out).toBe("2026-10-15 15:00:00");
  });
  it("missing OUT is flagged and gets no C-Off; access denied is ignored", () => {
    const [d] = one([P("2026-10-16 06:00:00", "Entry"), P("2026-10-16 15:00:00", "Exit", "Access Denied")]);
    expect(d).toMatchObject({ out: null, coff: 0, flags: ["OUT punch missing"] });
  });
  it("a span over 16 hours is flagged with 0 C-Off", () => {
    const [d] = one([P("2026-10-17 06:00:00", "Entry"), P("2026-10-17 12:00:00", "Exit"), P("2026-10-17 13:00:00", "Entry"), P("2026-10-17 23:00:00", "Exit")]);
    expect(d.coff).toBe(0);
    expect(d.flags[0]).toMatch(/span 17.0h/);
  });
});

// October-2026 parity: the engine must give exactly what the issued October files were built from.
// The punch files and answers contain personal data, so they live outside the repository:
// set VEC_GOLDEN_DIR to a folder with oct_duties.json and the three Attendance_*.xlsx files.
const G = process.env.VEC_GOLDEN_DIR;
describe.skipIf(!G || !existsSync(`${G}/oct_duties.json`))("October 2026 golden test", () => {
  it("matches every IN, OUT, shift, late and C-Off for every card and day", () => {
    const want = JSON.parse(readFileSync(`${G}/oct_duties.json`, "utf8")) as Record<string, Record<string, Record<string, { inn: string | null; out: string | null; shift: string; late: number; coff: number }>>>;
    const got: typeof want = {};
    const shortDays = new Set<string>();
    // the engine must at least flag the days the office overrode
    const buildDutiesFlag = (_g: unknown, wo: string, card: string, day: string) => shortDays.has(`${wo} ${card} ${day}`);
    for (const f of ["Attendance_300005424 REF & PET.xlsx", "Attendance_300005425 REF & PET.xlsx", "Attendance_300005834 REF M&I.xlsx"]) {
      const { rows } = parsePunchWorkbook(readFileSync(`${G}/${f}`));
      const by = new Map<string, Punch[]>();
      for (const r of rows) { const k = `${r.wo}|${r.card}`; if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
      for (const [k, ps] of by) {
        const [wo, card] = k.split("|");
        const ds = buildDuties(ps, 2026, 10);
        for (const d of ds) if (d.flags.some((f) => f.startsWith("very short"))) shortDays.add(`${wo} ${card} ${d.day}`);
        (got[wo] ??= {})[card] = Object.fromEntries(ds.map((d) => [String(d.day), { inn: d.inn, out: d.out, shift: d.shift ?? "", late: d.late, coff: d.coff }]));
      }
    }
    const diffs: string[] = [];
    let days = 0;
    for (const [wo, cards] of Object.entries(want)) for (const [card, ds] of Object.entries(cards)) for (const [day, w] of Object.entries(ds)) {
      days++;
      const g = got[wo]?.[card]?.[day];
      const exp = { inn: w.inn, out: w.out, shift: w.shift ?? "", late: w.late, coff: w.coff };
      if (!g || JSON.stringify(g) !== JSON.stringify(exp)) diffs.push(`${wo} ${card} day ${day}: want ${JSON.stringify(exp)} got ${JSON.stringify(g)}`);
    }
    // Office decisions in October, not engine rules: 30-second in/out on 29-Oct marked as a card issue (REF M&I).
    const overrides = new Set(["300005834 46867257 29", "300005834 46867258 29"]);
    for (const [wo, cards] of Object.entries(got)) for (const [card, ds] of Object.entries(cards)) for (const day of Object.keys(ds))
      if (!want[wo]?.[card]?.[day] && !overrides.has(`${wo} ${card} ${day}`)) diffs.push(`${wo} ${card} day ${day}: extra duty`);
    for (const k of overrides) {
      const [wo, card, day] = k.split(" ");
      expect(buildDutiesFlag(got, wo, card, day)).toBe(true);
    }
    expect(diffs.slice(0, 15), `${diffs.length} differences in ${days} person-days`).toEqual([]);
  });
});
