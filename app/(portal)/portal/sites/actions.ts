"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { audit, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export type SiteInput = { code: string; name: string; client: string; state: string; billingModel: string };
export type UnitInput = { siteId: number; code: string; name: string; workOrders: string; mode: string };

const CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

export async function saveSite(id: number | null, v: SiteInput): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const code = v.code.trim().toUpperCase(), name = v.name.trim(), state = v.state.trim();
  if (!CODE.test(code)) return { error: "Code: 2–20 letters, digits or dashes (e.g. NFL-PNP)." };
  if (!name || !state) return { error: "Name and state are needed." };
  if (!["per_employee", "percent_of_bill"].includes(v.billingModel)) return { error: "Choose how the client pays." };
  const row = { code, name, client: v.client.trim() || null, state, billingModel: v.billingModel };
  try {
    if (id === null) await db().insert(schema.sites).values(row);
    else await db().update(schema.sites).set(row).where(eq(schema.sites.id, id));
  } catch { return { error: `Site code ${code} is already used.` }; }
  await audit(user.email, id === null ? "create" : "update", "site", code, row);
  revalidatePath("/portal/sites");
  return {};
}

export async function saveUnit(id: number | null, v: UnitInput): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const code = v.code.trim().toUpperCase(), name = v.name.trim();
  if (!CODE.test(code)) return { error: "Code: 2–20 letters, digits or dashes (e.g. ETP-PET)." };
  if (!name) return { error: "Name is needed." };
  if (!["punch", "file"].includes(v.mode)) return { error: "Choose where attendance comes from." };
  const workOrders = [...new Set(v.workOrders.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean))];
  if (workOrders.some((w) => !/^[A-Za-z0-9-]{3,30}$/.test(w))) return { error: "Work orders: letters and digits only, separated by commas." };
  if (v.mode === "punch" && !workOrders.length && code !== "DRIVERS") return { error: "A punch-based unit needs at least one work order (as in the gate file)." };
  const d = db();
  // a work order can belong to one unit only, or punches would be counted twice
  const others = await d.select({ code: schema.units.code, wo: schema.units.workOrders, id: schema.units.id }).from(schema.units);
  const clash = others.find((o) => o.id !== id && o.wo.some((w) => workOrders.includes(w)));
  if (clash) return { error: `Work order ${clash.wo.find((w) => workOrders.includes(w))} already belongs to ${clash.code}.` };
  const row = { siteId: v.siteId, code, name, workOrders, mode: v.mode };
  try {
    if (id === null) {
      const max = Math.max(0, ...(await d.select({ s: schema.units.sortOrder }).from(schema.units)).map((x) => x.s));
      await d.insert(schema.units).values({ ...row, sortOrder: max + 1 });
    } else await d.update(schema.units).set(row).where(eq(schema.units.id, id));
  } catch { return { error: `Unit code ${code} is already used.` }; }
  await audit(user.email, id === null ? "create" : "update", "unit", code, row);
  revalidatePath("/portal/sites");
  return {};
}

export async function saveTemplate(form: FormData): Promise<{ error?: string }> {
  const user = await requireUser("owner");
  const unitId = Number(form.get("unitId"));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose the unit's Working Salary workbook (.xlsx)." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Save it as .xlsx first (Excel → Save As → Excel Workbook)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return { error: "This file could not be opened as an Excel workbook." }; }
  if (!wb.worksheets.some((s) => /working\s*salary/i.test(s.name))) return { error: "No 'Working Salary' sheet in this workbook." };
  const [u] = await db().select({ code: schema.units.code }).from(schema.units).where(eq(schema.units.id, unitId));
  if (!u) return { error: "Unknown unit." };
  const row = { unitId, fileName: file.name, file: buf, uploadedBy: user.email, uploadedAt: new Date() };
  await db().insert(schema.excelTemplates).values(row).onConflictDoUpdate({ target: schema.excelTemplates.unitId, set: row });
  await audit(user.email, "upload", "excel_template", u.code, { fileName: file.name, bytes: buf.length, sheets: wb.worksheets.map((s) => s.name) });
  revalidatePath("/portal/sites");
  return {};
}
