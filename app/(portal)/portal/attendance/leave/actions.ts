"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

/** Owner correction of a person's opening L / CL for a month (e.g. a balance missing from the import). */
export async function setOpeningAction(unitCode: string, year: number, month: number, employeeId: number, cl: number, l: number, reason: string): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  if (![cl, l].every((x) => Number.isFinite(x) && x >= -31 && x <= 400)) return { error: "Enter the balances as numbers." };
  if (reason.trim().length < 3) return { error: "Give a reason (it goes in the audit log)." };
  const d = db();
  const [u] = await d.select().from(schema.units).where(eq(schema.units.code, unitCode));
  const [run] = u ? await d.select().from(schema.monthRuns).where(and(eq(schema.monthRuns.unitId, u.id), eq(schema.monthRuns.year, year), eq(schema.monthRuns.month, month))) : [];
  if (run && run.status !== "draft") return { error: `${unitCode} ${month}/${year} is ${run.status} — reopen it first.` };
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const t = schema.leaveOpening;
  const [before] = await d.select().from(t).where(and(eq(t.employeeId, employeeId), eq(t.month, first)));
  await d.insert(t).values({ employeeId, month: first, cl: String(cl), l: String(l), source: "manual" })
    .onConflictDoUpdate({ target: [t.employeeId, t.month], set: { cl: String(cl), l: String(l), source: "manual" } });
  await audit(user.email, "update", "leave_opening", employeeId, { unit: unitCode, month: first, before: before ? { cl: before.cl, l: before.l, source: before.source } : null, cl, l, reason });
  revalidatePath("/portal/attendance/leave");
  return {};
}
