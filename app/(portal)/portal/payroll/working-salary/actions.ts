"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getRun } from "@/lib/codes";

/** OT days, hold and leave encashment for one person and month — what the team typed into the October sheets. */
export async function setAdjustment(unitCode: string, year: number, month: number, employeeId: number,
  v: { otDays: number; hold: number; leaveEncashment: number; reason: string }): Promise<{ error?: string }> {
  const user = await requireUser();
  if (![v.otDays, v.hold, v.leaveEncashment].every((x) => Number.isFinite(x) && x >= 0)) return { error: "Enter numbers of 0 or more." };
  const [u] = await db().select().from(schema.units).where(eq(schema.units.code, unitCode));
  if (!u) return { error: "Unknown unit" };
  const run = await getRun(u.id, u.siteId, year, month, user.email);
  if (run.status === "locked") return { error: "This month is locked." };
  const t = schema.payAdjustments;
  if (v.otDays === 0 && v.hold === 0 && v.leaveEncashment === 0) {
    await db().delete(t).where(and(eq(t.runId, run.id), eq(t.employeeId, employeeId)));
  } else {
    if (v.reason.trim().length < 3) return { error: "Give a reason (it is kept in the log)." };
    const set = { otDays: String(v.otDays), hold: Math.round(v.hold), leaveEncashment: Math.round(v.leaveEncashment), reason: v.reason.trim().slice(0, 300), actor: user.email, at: new Date() };
    await db().insert(t).values({ runId: run.id, employeeId, ...set }).onConflictDoUpdate({ target: [t.runId, t.employeeId], set });
  }
  await audit(user.email, "pay-adjustment", "employee", employeeId, { unit: unitCode, year, month, ...v });
  revalidatePath("/portal/payroll/working-salary");
  return {};
}
