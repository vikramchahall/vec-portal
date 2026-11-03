"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getRun, OVERRIDE_CODES } from "@/lib/codes";

async function runFor(unitCode: string, year: number, month: number, actor: string) {
  const [u] = await db().select().from(schema.units).where(eq(schema.units.code, unitCode));
  if (!u) throw new Error("Unknown unit");
  const run = await getRun(u.id, u.siteId, year, month, actor);
  if (run.status === "locked") throw new Error("This month is locked — changes are made as arrears in a later month.");
  if (run.status === "approved") throw new Error("This month is approved — reopen it on the Approval screen to make changes.");
  return run;
}

const refresh = () => { revalidatePath("/portal/attendance/review"); revalidatePath("/portal/attendance/time-compliance"); };

export async function setHolidays(unitCode: string, year: number, month: number, text: string, allUnits: boolean): Promise<{ error?: string }> {
  const user = await requireUser();
  const days = [...new Set(text.split(/[\s,]+/).filter(Boolean).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 31).sort((a, b) => a - b);
  try {
    const run = await runFor(unitCode, year, month, user.email);
    const d = db();
    if (allUnits) {
      // same holidays for every unit of the site
      const [u] = await d.select().from(schema.units).where(eq(schema.units.code, unitCode));
      const siblings = await d.select().from(schema.units).where(eq(schema.units.siteId, u.siteId));
      for (const s of siblings) {
        const r = await getRun(s.id, s.siteId, year, month, user.email);
        if (r.status === "draft") await d.update(schema.monthRuns).set({ holidays: days, updatedBy: user.email, updatedAt: new Date() }).where(eq(schema.monthRuns.id, r.id));
      }
    } else await d.update(schema.monthRuns).set({ holidays: days, updatedBy: user.email, updatedAt: new Date() }).where(eq(schema.monthRuns.id, run.id));
    await audit(user.email, "holidays", "month_run", run.id, { unit: unitCode, year, month, days, allUnits });
  } catch (e) { return { error: e instanceof Error ? e.message : "failed" }; }
  refresh();
  return {};
}

/** Set (or clear, with code = null) one day's code for one person. Every change needs a reason and is logged. */
export async function setDayCode(unitCode: string, year: number, month: number, employeeId: number, days: number[], code: string | null, reason: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (code !== null && !(OVERRIDE_CODES as readonly string[]).includes(code)) return { error: "Unknown code." };
  if (code !== null && reason.trim().length < 3) return { error: "Give a reason (it is kept in the log)." };
  try {
    const run = await runFor(unitCode, year, month, user.email);
    const d = db();
    for (const day of days) {
      if (!Number.isInteger(day) || day < 1 || day > 31) continue;
      if (code === null) {
        await d.delete(schema.dayOverrides).where(and(eq(schema.dayOverrides.runId, run.id), eq(schema.dayOverrides.employeeId, employeeId), eq(schema.dayOverrides.day, day)));
      } else {
        await d.insert(schema.dayOverrides).values({ runId: run.id, employeeId, day, code, reason: reason.trim().slice(0, 300), actor: user.email })
          .onConflictDoUpdate({ target: [schema.dayOverrides.runId, schema.dayOverrides.employeeId, schema.dayOverrides.day], set: { code, reason: reason.trim().slice(0, 300), actor: user.email, at: new Date() } });
      }
    }
    await audit(user.email, code === null ? "clear-code" : "set-code", "employee", employeeId, { unit: unitCode, year, month, days, code, reason });
  } catch (e) { return { error: e instanceof Error ? e.message : "failed" }; }
  refresh();
  return {};
}
