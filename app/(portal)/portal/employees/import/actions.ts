"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { saveEmployee, unitList } from "@/lib/employees";
import { parseWorkbook, type ImportRow } from "@/lib/import";

export type PreviewRow = ImportRow & { unitCode: string; action: "new" | "update" | "same"; employeeId: number | null; changes: string[]; problems: string[] };
export type PreviewFile = { file: string; kind: string; warnings: string[]; rows: PreviewRow[]; error?: string };
export type PreviewState = { files: PreviewFile[]; monthStart: string } | { error: string } | null;

type Existing = { id: number; card_no: string; name: string; unit: string | null; designation: string | null; category: string | null; basic_da: number | null; hra: number | null;
  uan: string | null; ifsc: string | null; bank_name: string | null; account_last4: string | null; register_no: string | null };

export async function previewImport(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireUser();
  const unit = String(form.get("unit") ?? "");
  const monthStart = String(form.get("monthStart") ?? "") || "2026-10-01";
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one .xlsx file." };
  const units = new Set((await unitList()).map((u) => u.code));

  const parsed: PreviewFile[] = [];
  for (const f of files) {
    if (!/\.xlsx?m?$/i.test(f.name)) { parsed.push({ file: f.name, kind: "-", warnings: [], rows: [], error: "Not an Excel file." }); continue; }
    try {
      const r = parseWorkbook(Buffer.from(await f.arrayBuffer()));
      parsed.push({ file: f.name, kind: r.kind, warnings: r.warnings, rows: r.rows.map((x) => ({ ...x, unitCode: x.unitCode || unit, action: "new", employeeId: null, changes: [], problems: [] })) });
    } catch (e) {
      parsed.push({ file: f.name, kind: "-", warnings: [], rows: [], error: e instanceof Error ? e.message : "Could not read the file." });
    }
  }

  const cards = parsed.flatMap((p) => p.rows.map((r) => r.cardNo));
  const existing = cards.length ? (await db().execute(sql`SELECT e.id, c.card_no, e.name, u.code AS unit, a.designation, a.category, p.basic_da, p.hra, e.uan, e.ifsc, e.bank_name, e.account_last4, a.register_no
    FROM employee_cards c JOIN employees e ON e.id = c.employee_id
    LEFT JOIN LATERAL (SELECT * FROM assignments a WHERE a.employee_id = e.id AND a.valid_to IS NULL LIMIT 1) a ON true
    LEFT JOIN units u ON u.id = a.unit_id
    LEFT JOIN LATERAL (SELECT * FROM pay_structures p WHERE p.employee_id = e.id ORDER BY effective_from DESC LIMIT 1) p ON true
    WHERE c.valid_to IS NULL AND c.card_no IN (${sql.join(cards.map((c) => sql`${c}`), sql`, `)})`)) as unknown as Existing[] : [];
  const byCard = new Map(existing.map((e) => [e.card_no, e]));

  for (const p of parsed) for (const r of p.rows) {
    if (!r.unitCode) r.problems.push("No unit chosen");
    else if (!units.has(r.unitCode)) r.problems.push(`Unknown unit ${r.unitCode}`);
    if (r.basicDa === undefined) r.problems.push("No Basic + DA");
    const e = byCard.get(r.cardNo);
    if (!e) continue;
    r.employeeId = e.id;
    const diff = (label: string, before: unknown, after: unknown) => {
      if (after !== undefined && after !== null && after !== "" && String(before ?? "") !== String(after)) r.changes.push(`${label}: ${before ?? "—"} → ${after}`);
    };
    diff("unit", e.unit, r.unitCode);
    diff("designation", e.designation, r.designation);
    diff("category", e.category, r.category);
    diff("register no.", e.register_no, r.registerNo);
    diff("Basic + DA", e.basic_da, r.basicDa);
    diff("HRA", e.hra, r.hra);
    diff("UAN", e.uan, r.uan);
    diff("IFSC", e.ifsc, r.ifsc);
    diff("bank", e.bank_name, r.bankName);
    if (r.account && r.account.slice(-4) !== e.account_last4) r.changes.push("bank account changed");
    if (e.name !== r.name) r.changes.push(`name: ${e.name} → ${r.name}`);
    r.action = r.changes.length ? "update" : "same";
  }
  return { files: parsed, monthStart };
}

export type ApplyResult = { created: number; updated: number; unchanged: number; failed: { cardNo: string; name: string; error: string }[] } | { error: string };

export async function applyImport(rows: PreviewRow[], monthStart: string): Promise<ApplyResult> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthStart)) return { error: "Bad month." };
  let created = 0, updated = 0, unchanged = 0;
  const failed: { cardNo: string; name: string; error: string }[] = [];
  for (const r of rows) {
    if (r.problems.length) { failed.push({ cardNo: r.cardNo, name: r.name, error: r.problems.join("; ") }); continue; }
    if (r.action === "same") { unchanged++; continue; }
    try {
      const isNew = r.employeeId === null;
      const res = await saveEmployee(r.employeeId, {
        name: r.name, fatherName: r.fatherName, dob: r.dob, gender: r.gender, mobile: r.mobile, aadhaar: r.aadhaar, pan: r.pan,
        uan: r.uan, pfAccount: r.pfAccount, esicIp: r.esicIp, pfMember: r.pfMember, esiMember: r.esiMember, bonusMonthly: r.bonusMonthly,
        bankName: r.bankName, account: r.account, ifsc: r.ifsc, doj: r.doj, status: isNew ? "active" : undefined,
        cardNo: r.cardNo, unitCode: r.unitCode, registerNo: r.registerNo, designation: r.designation, category: r.category,
        woWeekday: r.woWeekday ?? (isNew ? "Sun" : undefined), isDriver: r.isDriver,
        basicDa: r.basicDa, hra: r.hra, special: r.special, conveyance: r.conveyance, others: r.others,
        effectiveFrom: isNew ? (r.doj ?? monthStart) : monthStart, structureFrom: isNew && r.doj && r.doj > monthStart ? r.doj : monthStart,
      });
      if (res.changes.length) await audit(user.email, isNew ? "create" : "update", "employee", res.id, ["import", ...res.changes]);
      if (isNew) created++; else updated++;
    } catch (e) {
      failed.push({ cardNo: r.cardNo, name: r.name, error: e instanceof Error ? e.message : "failed" });
    }
  }
  await audit(user.email, "import", "employees", null, { created, updated, unchanged, failed: failed.length, monthStart });
  revalidatePath("/portal/employees");
  revalidatePath("/portal");
  return { created, updated, unchanged, failed };
}
