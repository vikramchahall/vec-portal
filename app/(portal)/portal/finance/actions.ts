"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function setRate(unitCode: string, model: string, rate: number): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  if (!["per_employee", "percent"].includes(model)) return { error: "Choose per employee or percent." };
  if (!Number.isFinite(rate) || rate < 0 || (model === "percent" && rate > 100) || rate > 1_000_000) return { error: "Enter a valid rate." };
  const [u] = await db().update(schema.units).set({ billingModel: model, billingRate: String(rate) }).where(eq(schema.units.code, unitCode)).returning({ id: schema.units.id });
  if (!u) return { error: "Unknown unit." };
  await audit(user.email, "update", "billing_rate", unitCode, { model, rate });
  revalidatePath("/portal/finance");
  return {};
}

export type BillInput = { amount: string; billNo: string; billDate: string; passedOn: string; note: string };

export async function saveBill(unitCode: string, year: number, month: number, v: BillInput): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const [u] = await db().select().from(schema.units).where(eq(schema.units.code, unitCode));
  if (!u) return { error: "Unknown unit." };
  const d8 = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const t = schema.clientBills;
  if (v.amount.trim() === "") {
    // clearing the amount removes that month's bill
    await db().delete(t).where(and(eq(t.unitId, u.id), eq(t.year, year), eq(t.month, month)));
    await audit(user.email, "delete", "client_bill", `${unitCode} ${year}-${month}`);
    revalidatePath("/portal/finance");
    return {};
  }
  const amount = Number(v.amount.replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount the client passed (before GST)." };
  const row = { unitId: u.id, year, month, amount: String(amount), billNo: v.billNo.trim() || null, billDate: d8(v.billDate), passedOn: d8(v.passedOn), note: v.note.trim().slice(0, 300) || null, updatedBy: user.email, updatedAt: new Date() };
  await db().insert(schema.clientBills).values(row).onConflictDoUpdate({ target: [schema.clientBills.unitId, schema.clientBills.year, schema.clientBills.month], set: row });
  await audit(user.email, "update", "client_bill", `${unitCode} ${year}-${month}`, { amount, billNo: row.billNo });
  revalidatePath("/portal/finance");
  return {};
}
