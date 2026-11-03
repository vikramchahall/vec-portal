"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { revealValue, saveEmployee, type EmployeeInput } from "@/lib/employees";

export type FormState = { error?: string; fields?: Record<string, string> } | null;

const str = (f: FormData, k: string) => (f.has(k) ? String(f.get(k) ?? "") : undefined);
const num = (f: FormData, k: string) => { const v = str(f, k); return v === undefined || v.trim() === "" ? undefined : Math.round(Number(v.replace(/[,\s₹]/g, ""))); };
const bool = (f: FormData, k: string) => (f.has(`${k}__present`) ? f.get(k) === "on" : undefined);

function validate(x: EmployeeInput): string | null {
  if (x.aadhaar && !/^\d{12}$/.test(x.aadhaar.replace(/\s/g, ""))) return "Aadhaar must be 12 digits.";
  if (x.pan && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(x.pan.trim())) return "PAN must look like ABCDE1234F.";
  if (x.uan && !/^\d{12}$/.test(x.uan.trim())) return "UAN must be 12 digits.";
  if (x.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(x.ifsc.trim())) return "IFSC must look like SBIN0001234.";
  if (x.mobile && !/^(\+91[\s-]?)?[6-9]\d{4}\s?\d{5}$/.test(x.mobile.trim())) return "Mobile must be a 10-digit Indian number.";
  if (x.account && !/^\d{6,20}$/.test(x.account.replace(/\s/g, ""))) return "Bank account must be 6–20 digits.";
  if (x.basicDa !== undefined && (Number.isNaN(x.basicDa) || x.basicDa < 0)) return "Basic + DA must be a number.";
  return null;
}

export async function saveEmployeeAction(id: number | null, _prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const x: EmployeeInput = {
    name: str(f, "name"), fatherName: str(f, "fatherName"), dob: str(f, "dob"), gender: str(f, "gender"), mobile: str(f, "mobile"), address: str(f, "address"),
    uan: str(f, "uan"), pfAccount: str(f, "pfAccount"), esicIp: str(f, "esicIp"),
    pfMember: bool(f, "pfMember"), esiMember: bool(f, "esiMember"), bonusMonthly: bool(f, "bonusMonthly"),
    bankName: str(f, "bankName"), ifsc: str(f, "ifsc"), status: str(f, "status"), doj: str(f, "doj"), dol: str(f, "dol"), notes: str(f, "notes"),
    cardNo: str(f, "cardNo"), unitCode: str(f, "unitCode"), registerNo: str(f, "registerNo"), designation: str(f, "designation"),
    category: str(f, "category"), woWeekday: str(f, "woWeekday"), isDriver: bool(f, "isDriver"),
    basicDa: num(f, "basicDa"), hra: num(f, "hra"), special: num(f, "special"), conveyance: num(f, "conveyance"), others: num(f, "others"),
    effectiveFrom: str(f, "effectiveFrom") || undefined,
  };
  // secret fields: an empty box on the edit form means "keep what is stored"
  for (const k of ["aadhaar", "pan", "account"] as const) {
    const v = str(f, k);
    if (v && v.trim()) x[k] = v.trim();
    else if (f.get(`${k}__clear`) === "on") x[k] = "";
  }
  const fields = Object.fromEntries([...f.entries()].filter(([k]) => !["aadhaar", "pan", "account"].includes(k)).map(([k, v]) => [k, String(v)]));
  if (id === null && !x.name?.trim()) return { error: "Name is required.", fields };
  if (id === null && !x.unitCode) return { error: "Choose the unit.", fields };
  const bad = validate(x);
  if (bad) return { error: bad, fields };
  let saved: { id: number; changes: string[] };
  try {
    saved = await saveEmployee(id, x);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save.", fields };
  }
  if (saved.changes.length) await audit(user.email, id === null ? "create" : "update", "employee", saved.id, saved.changes);
  revalidatePath("/portal/employees");
  redirect(`/portal/employees/${saved.id}?saved=1`);
}

/** Owner only: show a full Aadhaar / PAN / account number once, and log that it was viewed. */
export async function revealAction(id: number, field: "aadhaar" | "pan" | "account"): Promise<{ value: string | null; error?: string }> {
  const user = await requireUser();
  if (user.role !== "owner") return { value: null, error: "Only the owner can see full numbers." };
  const [e] = await db().select().from(schema.employees).where(eq(schema.employees.id, id));
  if (!e) return { value: null, error: "Not found" };
  await audit(user.email, "reveal", "employee", id, { field });
  return { value: revealValue(e, field) };
}
