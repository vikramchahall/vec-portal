"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function markDone(itemId: number, dueDate: string, reference: string, note: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Bad date." };
  const row = { itemId, dueDate, doneBy: user.email, doneAt: new Date(), reference: reference.trim().slice(0, 80) || null, note: note.trim().slice(0, 300) || null };
  await db().insert(schema.complianceDone).values(row).onConflictDoUpdate({ target: [schema.complianceDone.itemId, schema.complianceDone.dueDate], set: row });
  await audit(user.email, "done", "compliance", itemId, { dueDate, reference: row.reference });
  revalidatePath("/portal/statutory/calendar");
  return {};
}

export async function undoDone(itemId: number, dueDate: string): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  await db().delete(schema.complianceDone).where(and(eq(schema.complianceDone.itemId, itemId), eq(schema.complianceDone.dueDate, dueDate)));
  await audit(user.email, "undo", "compliance", itemId, { dueDate });
  revalidatePath("/portal/statutory/calendar");
  return {};
}

export type ItemInput = { title: string; authority: string; frequency: string; dueDay: number; dueMonths: string; period: string; appliesTo: string; notes: string; active: boolean };

export async function saveItem(id: number | null, v: ItemInput): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const title = v.title.trim();
  if (!title) return { error: "Give the obligation a name." };
  if (!["monthly", "half_yearly", "yearly"].includes(v.frequency)) return { error: "Choose how often it is due." };
  if (!Number.isInteger(v.dueDay) || v.dueDay < 1 || v.dueDay > 31) return { error: "Due day: 1 to 31." };
  const months = [...new Set(v.dueMonths.split(/[\s,]+/).filter(Boolean).map(Number))].filter((n) => n >= 1 && n <= 12).sort((a, b) => a - b);
  if (v.frequency !== "monthly" && !months.length) return { error: "Give the month(s) it falls in, e.g. 4, 10." };
  const row = { title, authority: v.authority.trim() || null, frequency: v.frequency, dueDay: v.dueDay, dueMonths: v.frequency === "monthly" ? [] : months,
    period: v.period.trim() || "previous month", appliesTo: v.appliesTo.trim() || null, notes: v.notes.trim() || null, active: v.active };
  if (id === null) await db().insert(schema.complianceItems).values({ ...row, sortOrder: 100 });
  else await db().update(schema.complianceItems).set(row).where(eq(schema.complianceItems.id, id));
  await audit(user.email, id === null ? "create" : "update", "compliance_item", id ?? title, row);
  revalidatePath("/portal/statutory/calendar");
  return {};
}
