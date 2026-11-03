"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { approveMonth, lockMonth, reopenMonth } from "@/lib/lock";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export async function lockPhrase(unit: string, year: number, month: number) { return `LOCK ${unit} ${MON[month - 1]}-${year}`; }

function refresh() {
  for (const p of ["/portal/payroll/approval", "/portal/payroll/working-salary", "/portal/attendance/review", "/portal/attendance/time-compliance"]) revalidatePath(p);
}

export async function approveAction(unit: string, year: number, month: number, note: string): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const r = await approveMonth(unit, year, month, user.email);
  if (!r.error) await audit(user.email, "approve", "month_run", `${unit} ${year}-${month}`, { note });
  refresh();
  return r;
}

export async function reopenAction(unit: string, year: number, month: number, reason: string): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  if (reason.trim().length < 3) return { error: "Give a reason (it is kept in the log)." };
  const r = await reopenMonth(unit, year, month, user.email);
  if (!r.error) await audit(user.email, "reopen", "month_run", `${unit} ${year}-${month}`, { reason });
  refresh();
  return r;
}

export async function lockAction(unit: string, year: number, month: number, typed: string): Promise<{ error?: string; carried?: number }> {
  const user = await requireUser("owner");
  if (typed.trim().toUpperCase() !== (await lockPhrase(unit, year, month))) return { error: "The confirmation text does not match." };
  const r = await lockMonth(unit, year, month, user.email);
  if (!r.error) await audit(user.email, "lock", "month_run", `${unit} ${year}-${month}`, { carried: r.carried });
  refresh();
  return r;
}
