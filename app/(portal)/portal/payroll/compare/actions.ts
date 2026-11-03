"use server";

import { requireUser } from "@/lib/auth";
import { compareWithExcel, type CompareResult } from "@/lib/compare";
import { monthSalary } from "@/lib/payroll";

export async function compareAction(form: FormData): Promise<{ error?: string; result?: CompareResult }> {
  await requireUser();
  const unit = String(form.get("unit") ?? ""), month = String(form.get("month") ?? "");
  const [y, m] = month.split("-").map(Number);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose the Working Salary workbook made in Excel." };
  const ms = unit && y && m ? await monthSalary(unit, y, m) : null;
  if (!ms) return { error: `No ${unit} data for ${month} in the portal yet.` };
  try {
    return { result: compareWithExcel(Buffer.from(await file.arrayBuffer()), ms) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "This file could not be read." };
  }
}
