"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import type { PunchRow } from "@/lib/punches";

// The browser reads the workbook and sends the punches in batches; the server only checks and stores them.

export async function beginPunchUpload(meta: { fileName: string; sha256: string; format: string; month: string | null; rows: number }):
  Promise<{ fileId: number } | { error: string }> {
  const user = await requireUser();
  if (!/^[0-9a-f]{64}$/.test(meta.sha256)) return { error: "Bad file fingerprint." };
  const d = db();
  const [dup] = await d.select().from(schema.punchFiles).where(eq(schema.punchFiles.sha256, meta.sha256));
  if (dup?.status === "complete") return { error: `This exact file was already uploaded as "${dup.fileName}" on ${dup.uploadedAt.toLocaleDateString("en-IN")}.` };
  if (dup) await d.delete(schema.punchFiles).where(eq(schema.punchFiles.id, dup.id)); // an upload that stopped half way
  const [f] = await d.insert(schema.punchFiles).values({
    fileName: meta.fileName.slice(0, 200), sha256: meta.sha256, format: meta.format === "daily" ? "daily" : "gate",
    month: meta.month && /^\d{4}-\d{2}$/.test(meta.month) ? meta.month : null, uploadedBy: user.email,
  }).returning({ id: schema.punchFiles.id });
  return { fileId: f.id };
}

const TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export async function addPunchBatch(fileId: number, rows: PunchRow[]): Promise<{ stored: number } | { error: string }> {
  await requireUser();
  if (!Number.isInteger(fileId) || rows.length > 6000) return { error: "Bad batch." };
  const clean = rows.filter((r) => TS.test(r.ts) && (r.dir === "Entry" || r.dir === "Exit") && /^[A-Za-z0-9-]{1,20}$/.test(r.card) && r.wo && r.wo.length <= 30)
    .map((r) => ({ fileId, cardNo: r.card, ts: r.ts, dir: r.dir, access: String(r.access).slice(0, 40), workOrder: r.wo, name: String(r.name ?? "").slice(0, 80) || null, designation: String(r.desig ?? "").slice(0, 80) || null }));
  if (!clean.length) return { stored: 0 };
  const res = await db().insert(schema.punches).values(clean).onConflictDoNothing().returning({ id: schema.punches.id });
  return { stored: res.length };
}

export async function finishPunchUpload(fileId: number): Promise<{ rows: number }> {
  const user = await requireUser();
  const d = db();
  const [{ n }] = (await d.execute(sql`SELECT count(*)::int AS n FROM punches WHERE file_id = ${fileId}`)) as unknown as { n: number }[];
  const [f] = await d.update(schema.punchFiles).set({ status: "complete", rows: n }).where(eq(schema.punchFiles.id, fileId)).returning();
  await audit(user.email, "upload", "punch_file", fileId, { file: f?.fileName, month: f?.month, rows: n });
  revalidatePath("/portal/attendance");
  return { rows: n };
}

export async function deletePunchFile(fileId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (user.role !== "owner") return { ok: false, error: "Only the owner can remove an uploaded file." };
  const [f] = await db().delete(schema.punchFiles).where(eq(schema.punchFiles.id, fileId)).returning();
  await audit(user.email, "delete", "punch_file", fileId, { file: f?.fileName });
  revalidatePath("/portal/attendance");
  return { ok: true };
}
