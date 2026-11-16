"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { encryptBytes } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { DOC_KINDS, DOC_TYPES, MAX_DOC_BYTES } from "@/lib/documents";

export async function uploadDocument(form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const employeeId = Number(form.get("employeeId"));
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!DOC_KINDS.some(([k]) => k === kind)) return { error: "Choose what the document is." };
  if (!(file instanceof File) || !file.size) return { error: "Choose a file." };
  if (file.size > MAX_DOC_BYTES) return { error: "Files up to 5 MB — take a smaller photo or scan at a lower resolution." };
  const mime = file.type || "";
  if (!DOC_TYPES[mime]) return { error: "PDF, JPG, PNG or WEBP only." };
  const [e] = await db().select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!e) return { error: "Unknown employee." };
  const buf = Buffer.from(await file.arrayBuffer());
  await db().insert(schema.employeeDocuments).values({ employeeId, kind, fileName: file.name.slice(0, 160), mime, bytes: buf.length, data: encryptBytes(buf),
    note: String(form.get("note") ?? "").trim().slice(0, 200) || null, uploadedBy: user.email });
  await audit(user.email, "upload", "employee_document", employeeId, { kind, fileName: file.name, bytes: buf.length });
  revalidatePath(`/portal/employees/${employeeId}`);
  return {};
}

export async function deleteDocument(employeeId: number, id: number): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const t = schema.employeeDocuments;
  const [d] = await db().delete(t).where(and(eq(t.id, id), eq(t.employeeId, employeeId))).returning({ kind: t.kind, fileName: t.fileName });
  if (d) await audit(user.email, "delete", "employee_document", employeeId, d);
  revalidatePath(`/portal/employees/${employeeId}`);
  return {};
}
