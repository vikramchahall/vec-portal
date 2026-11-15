"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

const STATUS = { enquiry: ["new", "replied", "closed"], application: ["new", "called", "shortlisted", "not_suitable"] } as const;

export async function setFormStatus(kind: "enquiry" | "application", id: number, status: string, note: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(STATUS[kind] as readonly string[]).includes(status)) return { error: "Unknown status." };
  const t = kind === "enquiry" ? schema.enquiries : schema.jobApplications;
  await db().update(t).set({ status, note: note.trim().slice(0, 500) || null }).where(eq(t.id, id));
  await audit(user.email, "update", kind === "enquiry" ? "enquiry" : "job_application", id, { status });
  revalidatePath("/portal/enquiries");
  return {};
}
