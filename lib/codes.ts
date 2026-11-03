import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { monthBounds, timeCompliance, type TcPerson, type TcResult } from "@/lib/attendance";
import { coverAndBalances, weeklyOffCodes, DEFAULT_LEAVE, type Balances, type Code } from "@/lib/engine/codes";

export const OVERRIDE_CODES = ["P", "HP", "H", "WO", "X", "L", "CL", "OD", "NOPUNCH"] as const;
export type OverrideCode = (typeof OVERRIDE_CODES)[number];

export type PersonMonth = TcPerson & {
  raw: Code[]; final: Code[]; b: Balances | null; overrides: Map<number, { code: string; reason: string; actor: string }>;
  hasOpening: boolean;
};
export type Exception = { kind: string; severity: "block" | "review" | "info"; card: string; employeeId: number | null; name: string; detail: string; day?: number };
export type MonthAttendance = TcResult & { run: typeof schema.monthRuns.$inferSelect; persons: PersonMonth[]; exceptions: Exception[] };

const monthStart = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;

/** Opening leave balance for a month. A balance carried from a locked month is never overwritten by an import. */
export async function setOpening(employeeId: number, month: string, cl: number, l: number, source: "import" | "locked-month" | "manual") {
  const t = schema.leaveOpening;
  await db().insert(t).values({ employeeId, month, cl: String(cl), l: String(l), source })
    .onConflictDoUpdate({ target: [t.employeeId, t.month], set: { cl: String(cl), l: String(l), source }, where: source === "locked-month" ? undefined : sql`${t.source} <> 'locked-month'` });
}

/** The unit's record for the month; created on first use with the holidays another unit of the same site already has. */
export async function getRun(unitId: number, siteId: number, year: number, month: number, actor?: string) {
  const d = db();
  const [run] = await d.select().from(schema.monthRuns).where(and(eq(schema.monthRuns.unitId, unitId), eq(schema.monthRuns.year, year), eq(schema.monthRuns.month, month)));
  if (run) return run;
  const [sibling] = (await d.execute(sql`SELECT r.holidays FROM month_runs r JOIN units u ON u.id = r.unit_id
    WHERE u.site_id = ${siteId} AND r.year = ${year} AND r.month = ${month} ORDER BY r.updated_at DESC LIMIT 1`)) as unknown as { holidays: number[] }[];
  const [created] = await d.insert(schema.monthRuns).values({ unitId, year, month, holidays: sibling?.holidays ?? [], updatedBy: actor ?? null })
    .onConflictDoNothing().returning();
  return created ?? (await d.select().from(schema.monthRuns).where(and(eq(schema.monthRuns.unitId, unitId), eq(schema.monthRuns.year, year), eq(schema.monthRuns.month, month))))[0];
}

/**
 * Codes, L / CL cover, balances and exceptions for one unit and month — the
 * Punch Attendance, Attendance Format and C-Off sheets, worked out from the punches.
 */
export async function monthAttendance(unitCode: string, year: number, month: number): Promise<MonthAttendance | null> {
  const tc = await timeCompliance(unitCode, year, month);
  if (!tc) return null;
  const d = db();
  const run = await getRun(tc.unit.id, tc.unit.siteId, year, month);
  const ov = await d.select().from(schema.dayOverrides).where(eq(schema.dayOverrides.runId, run.id));
  const ids = tc.people.map((p) => p.employeeId).filter((x): x is number => x !== null);
  const opening = ids.length ? await d.select().from(schema.leaveOpening).where(and(eq(schema.leaveOpening.month, monthStart(year, month)), sql`${schema.leaveOpening.employeeId} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)) : [];
  const openBy = new Map(opening.map((o) => [o.employeeId, o]));
  const { first } = monthBounds(year, month);
  const leave = { ...DEFAULT_LEAVE, cover: tc.unit.code !== "DRIVERS" }; // drivers: no leave cover (October rule)

  const persons: PersonMonth[] = tc.people.map((p) => {
    const mine = new Map(ov.filter((o) => o.employeeId === p.employeeId).map((o) => [o.day, { code: o.code, reason: o.reason, actor: o.actor }]));
    if (!p.known) return { ...p, raw: [], final: [], b: null, overrides: mine, hasOpening: false };
    const worked = new Set(p.duties.map((x) => x.day).filter((day) => mine.get(day)?.code !== "NOPUNCH"));
    const joinedDay = p.doj && p.doj > first && p.doj.slice(0, 7) === first.slice(0, 7) ? Number(p.doj.slice(8, 10)) : null;
    const raw = weeklyOffCodes({ year, month, days: tc.days, holidays: run.holidays, woWeekday: p.woWeekday, joinedDay, worked });
    for (const [day, o] of mine) if (o.code !== "NOPUNCH" && day >= 1 && day <= tc.days) raw[day - 1] = o.code as Code;
    const coff = Array(tc.days).fill(0);
    for (const x of p.duties) if (worked.has(x.day)) coff[x.day - 1] = x.coff;
    const o = openBy.get(p.employeeId!);
    const b = coverAndBalances(raw, coff, { cl: o ? Number(o.cl) : 0, l: o ? Number(o.l) : 0 }, leave);
    return { ...p, raw, final: b.final, b, overrides: mine, hasOpening: Boolean(o) };
  });

  // ---- exceptions (BRD-01 3.10)
  const ex: Exception[] = [];
  for (const p of persons) {
    const base = { card: p.card, employeeId: p.employeeId, name: p.name };
    if (!p.known) { ex.push({ ...base, kind: "UNKNOWN_CARD", severity: "block", detail: `Not in the employee master · ${p.designation ?? ""} · first punch ${p.duties[0]?.day ?? "?"}-${month}` }); continue; }
    if (!p.duties.length) ex.push({ ...base, kind: "NO_PUNCH", severity: "block", detail: "No duty this month — left, transferred, or full-month rule needed" });
    if (!p.hasOpening) ex.push({ ...base, kind: "NO_OPENING_BALANCE", severity: "review", detail: "No opening L / CL balance for this month — treated as 0 (import the previous month's file)" });
    for (const x of p.duties) {
      if (p.overrides.has(x.day)) continue;
      if (!x.inn || !x.out) ex.push({ ...base, kind: !x.inn ? "MISSING_IN" : "MISSING_OUT", severity: "review", day: x.day, detail: `${x.day}-${month}: ${!x.inn ? "no IN" : "no OUT"} punch — counted present` });
      for (const f of x.flags) if (f.startsWith("span")) ex.push({ ...base, kind: "LONG_SPAN", severity: "review", day: x.day, detail: `${x.day}-${month}: ${f}` });
      for (const f of x.flags) if (f.startsWith("very short")) ex.push({ ...base, kind: "CARD_ISSUE", severity: "review", day: x.day, detail: `${x.day}-${month}: in/out within 5 minutes — card issue? (set the day to "ignore punches")` });
    }
    if (p.b && p.b.counts.X >= 5) ex.push({ ...base, kind: "MANY_X", severity: "info", detail: `${p.b.counts.X} days X (unpaid) after L / CL cover` });
    const late = p.duties.filter((x) => x.late > 0).length;
    if (late >= 3) ex.push({ ...base, kind: "LATE", severity: "info", detail: `Late on ${late} days (report only)` });
  }
  if (!run.holidays.length) ex.unshift({ kind: "NO_HOLIDAYS", severity: "review", card: "", employeeId: null, name: "", detail: "No holidays set for this month — set them above (October 2026: 2 and 20)" });
  // people of other units punching on this unit's work order
  if (tc.unit.workOrders.length) {
    const other = (await d.execute(sql`SELECT DISTINCT p.card_no, e.id, e.name, u.code AS unit FROM punches p
      JOIN employee_cards c ON c.card_no = p.card_no AND c.valid_to IS NULL JOIN employees e ON e.id = c.employee_id
      JOIN assignments a ON a.employee_id = e.id AND a.valid_to IS NULL JOIN units u ON u.id = a.unit_id
      WHERE p.work_order IN (${sql.join(tc.unit.workOrders.map((w) => sql`${w}`), sql`, `)}) AND u.id <> ${tc.unit.id}
        AND p.ts >= ${first}::date AND p.ts < (${first}::date + interval '1 month')`)) as unknown as { card_no: string; id: number; name: string; unit: string }[];
    for (const o of other) ex.push({ kind: "OTHER_WORK_ORDER", severity: "info", card: o.card_no, employeeId: o.id, name: o.name, detail: `Assigned to ${o.unit} but punches on ${tc.unit.code}'s work order — counted in ${o.unit}` });
  }
  // pay below the category minimum wage
  if (ids.length) {
    const low = (await d.execute(sql`SELECT e.id, e.name, a.category, p.basic_da, mw.monthly_rate FROM employees e
      JOIN assignments a ON a.employee_id = e.id AND a.valid_to IS NULL AND a.unit_id = ${tc.unit.id}
      JOIN units u ON u.id = a.unit_id JOIN sites s ON s.id = u.site_id
      JOIN LATERAL (SELECT basic_da FROM pay_structures ps WHERE ps.employee_id = e.id AND ps.effective_from <= (${first}::date + interval '1 month' - interval '1 day') ORDER BY effective_from DESC LIMIT 1) p ON true
      JOIN LATERAL (SELECT monthly_rate FROM min_wages m WHERE m.state = s.state AND m.category = a.category AND m.effective_from <= (${first}::date + interval '1 month' - interval '1 day') ORDER BY effective_from DESC LIMIT 1) mw ON true
      WHERE p.basic_da < mw.monthly_rate AND NOT a.is_driver`)) as unknown as { id: number; name: string; category: string; basic_da: number; monthly_rate: number }[];
    for (const l of low) ex.push({ kind: "BELOW_MW", severity: "block", card: persons.find((p) => p.employeeId === l.id)?.card ?? "", employeeId: l.id, name: l.name, detail: `${l.category}: Basic + DA ₹${l.basic_da} is below the minimum ₹${l.monthly_rate}` });
  }
  const order = { block: 0, review: 1, info: 2 };
  ex.sort((a, b) => order[a.severity] - order[b.severity]);
  return { ...tc, run, persons, exceptions: ex };
}
