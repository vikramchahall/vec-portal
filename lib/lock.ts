import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { setOpening } from "@/lib/codes";
import { monthSalary, type MonthSalary, type PayRow } from "@/lib/payroll";
import { WEEKDAYS } from "@/lib/engine/codes";

/**
 * Month approval and lock (BRD-01 11.4, MBD-01 S5).
 *   draft    — codes and entries can be changed
 *   approved — owner has approved; nothing can be changed; can be reopened
 *   locked   — final: the month's codes, balances and salary are frozen (run_snapshots),
 *              closing L / CL open the next month and the usual weekly-off day is carried.
 */
export type Check = { ok: boolean; text: string };

export function approvalChecks(ms: MonthSalary): Check[] {
  const blocks = ms.exceptions.filter((e) => e.severity === "block");
  const noStruct = ms.rows.filter((r) => r.problem);
  return [
    { ok: ms.rows.length > 0, text: `${ms.rows.length} employees with day codes` },
    { ok: ms.run.holidays.length > 0, text: ms.run.holidays.length ? `Holidays set: ${ms.run.holidays.join(", ")}` : "No holidays set for the month" },
    { ok: blocks.length === 0, text: blocks.length ? `${blocks.length} blocking exception${blocks.length > 1 ? "s" : ""} open (${[...new Set(blocks.map((b) => b.kind))].join(", ")})` : "No blocking exceptions" },
    { ok: noStruct.length === 0, text: noStruct.length ? `${noStruct.length} without a pay structure` : "Everyone has a pay structure" },
  ];
}

async function runOf(unitCode: string, year: number, month: number) {
  const [r] = (await db().execute(sql`SELECT r.* FROM month_runs r JOIN units u ON u.id = r.unit_id WHERE u.code = ${unitCode} AND r.year = ${year} AND r.month = ${month}`)) as unknown as { id: number; status: string }[];
  return r ?? null;
}

export async function approveMonth(unitCode: string, year: number, month: number, actor: string): Promise<{ error?: string }> {
  const ms = await monthSalary(unitCode, year, month);
  if (!ms) return { error: "Unknown unit" };
  if (ms.run.status !== "draft") return { error: `Already ${ms.run.status}.` };
  const failed = approvalChecks(ms).filter((c) => !c.ok);
  if (failed.length) return { error: failed.map((c) => c.text).join("; ") };
  await db().update(schema.monthRuns).set({ status: "approved", approvedBy: actor, approvedAt: new Date(), updatedBy: actor, updatedAt: new Date() }).where(eq(schema.monthRuns.id, ms.run.id));
  return {};
}

export async function reopenMonth(unitCode: string, year: number, month: number, actor: string): Promise<{ error?: string }> {
  const r = await runOf(unitCode, year, month);
  if (!r) return { error: "Nothing to reopen." };
  if (r.status === "locked") return { error: "A locked month cannot be reopened — corrections go into a later month." };
  await db().update(schema.monthRuns).set({ status: "draft", approvedBy: null, approvedAt: null, updatedBy: actor, updatedAt: new Date() }).where(eq(schema.monthRuns.id, r.id));
  return {};
}

const serialize = (r: PayRow) => ({ ...r, p: { ...r.p, overrides: [...r.p.overrides.entries()] } });

export async function lockMonth(unitCode: string, year: number, month: number, actor: string): Promise<{ error?: string; carried?: number }> {
  const ms = await monthSalary(unitCode, year, month);
  if (!ms) return { error: "Unknown unit" };
  if (ms.run.status !== "approved") return { error: ms.run.status === "locked" ? "Already locked." : "Approve the month first." };
  const d = db();
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const rows = ms.rows.filter((r) => r.line);
  await d.transaction(async (tx) => {
    for (const r of rows) {
      await tx.insert(schema.runSnapshots).values({ runId: ms.run.id, employeeId: r.p.employeeId!, data: serialize(r) })
        .onConflictDoUpdate({ target: [schema.runSnapshots.runId, schema.runSnapshots.employeeId], set: { data: serialize(r) } });
      // the usual weekly-off day for next month = the most common WO weekday this month
      const wo = new Map<number, number>();
      r.p.final.forEach((c, i) => { if (c === "WO") { const wd = new Date(Date.UTC(year, month - 1, i + 1)).getUTCDay(); wo.set(wd, (wo.get(wd) ?? 0) + 1); } });
      const best = [...wo.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) await tx.update(schema.assignments).set({ woWeekday: WEEKDAYS[best[0]] })
        .where(and(eq(schema.assignments.employeeId, r.p.employeeId!), eq(schema.assignments.unitId, ms.unit.id), sql`${schema.assignments.validTo} IS NULL`));
    }
    await tx.update(schema.monthRuns).set({ status: "locked", lockedBy: actor, lockedAt: new Date(), updatedBy: actor, updatedAt: new Date() }).where(eq(schema.monthRuns.id, ms.run.id));
  });
  // closing balances open next month (a later import never overwrites these)
  for (const r of rows) await setOpening(r.p.employeeId!, next, r.p.b!.close.cl, r.p.b!.close.l, "locked-month");
  return { carried: rows.length };
}
