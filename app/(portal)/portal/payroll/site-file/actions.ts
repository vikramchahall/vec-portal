"use server";

import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { previewSiteFile, saveSiteFile } from "@/lib/site-salary";

export type SitePreview = {
  sheet: string; days: number; warnings: string[];
  people: { card: string; name: string; designation: string | null; days: number; lop: number; totalEarning: number; pfEE: number; esiEE: number; net: number; isNew: boolean; codes: boolean }[];
  totals: { totalEarning: number; pf: number; esi: number; net: number };
};

const readFile = async (form: FormData) => {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose the site's Working Salary workbook.");
  if (!/\.xls[xm]$/i.test(file.name)) throw new Error("Use the .xlsx / .xlsm workbook.");
  return { name: file.name, buf: Buffer.from(await file.arrayBuffer()) };
};

export async function previewSiteAction(form: FormData): Promise<{ error?: string; preview?: SitePreview }> {
  await requireUser();
  try {
    const { buf } = await readFile(form);
    const p = await previewSiteFile(String(form.get("unit")), buf);
    const wrong = monthMismatch(p.sheet, String(form.get("month") ?? ""));
    if (wrong) p.warnings.unshift(wrong);
    const sum = (k: "totalEarning" | "pfEE" | "esiEE" | "net") => Math.round(p.people.reduce((s, r) => s + r[k], 0));
    return { preview: {
      sheet: p.sheet, days: p.days, warnings: p.warnings,
      people: p.people.map((r) => ({ card: r.card, name: r.name, designation: r.designation, days: r.days, lop: r.lop, totalEarning: r.totalEarning, pfEE: Math.round(r.pfEE), esiEE: Math.round(r.esiEE), net: r.net, isNew: !r.match, codes: !!r.codes })),
      totals: { totalEarning: sum("totalEarning"), pf: sum("pfEE"), esi: sum("esiEE"), net: sum("net") },
    } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The file could not be read." };
  }
}

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Working Salary Oct-26" / "Working Salary OCT - 2026" for 2026-11 → a warning */
function monthMismatch(sheet: string, month: string) {
  const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s*[-\s]\s*(\d{2}|\d{4})/i.exec(sheet);
  const [y, mo] = month.split("-").map(Number);
  if (!m || !y) return null;
  const sy = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), sm = MON.indexOf(m[1].toLowerCase()) + 1;
  return sy === y && sm === mo ? null : `The sheet "${sheet}" is for ${MON[sm - 1].toUpperCase()}-${sy}, not ${MON[mo - 1].toUpperCase()}-${y}.`;
}

export async function saveSiteAction(form: FormData): Promise<{ error?: string; added?: number; rows?: number; monthWarning?: boolean }> {
  const user = await requireUser();
  const unit = String(form.get("unit")), month = String(form.get("month"));
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return { error: "Choose the month." };
  try {
    const { name, buf } = await readFile(form);
    if (form.get("confirmMonth") !== "1") {
      const { parseSiteWorkbook } = await import("@/lib/site-file");
      const wrong = monthMismatch(parseSiteWorkbook(buf).sheet, month);
      if (wrong) return { error: `${wrong} Choose the right month, or save again to keep it.`, monthWarning: true };
    }
    const r = await saveSiteFile(unit, y, m, name, buf, user.email);
    if (!r.error) {
      await audit(user.email, "upload", "site_salary_file", `${unit} ${month}`, { file: name, rows: r.rows, added: r.added });
      revalidatePath("/portal/payroll/working-salary");
    }
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The file could not be saved." };
  }
}
