import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { unitList } from "@/lib/employees";
import { monthSalary } from "@/lib/payroll";

/**
 * Reports & Analytics (MBD-01 S9). Salary figures come from each unit's Working Salary for the month —
 * the frozen copy for locked months, the current figures for draft / approved ones — so every report
 * agrees with the payslips. Only months that have data are read (gate punches on the unit's work orders,
 * or an uploaded site file), so opening a report never creates empty months.
 */
export type UnitMonth = {
  unit: string; month: string; status: string; people: number; payableDays: number; lop: number;
  totalEarning: number; net: number; pfEE: number; pfER: number; esiEE: number; esiER: number; bonus: number; ctc: number; ctcBilling: number;
};

/** Months (YYYY-MM) that have salary data for each unit, newest first. */
export async function dataMonths() {
  const units = await unitList();
  const punch = (await db().execute(sql`SELECT DISTINCT to_char(ts, 'YYYY-MM') AS month, work_order FROM punches`)) as unknown as { month: string; work_order: string }[];
  const files = (await db().execute(sql`SELECT u.code, r.year, r.month FROM site_salary_files f JOIN month_runs r ON r.id = f.run_id JOIN units u ON u.id = r.unit_id`)) as unknown as { code: string; year: number; month: number }[];
  const byUnit = new Map<string, Set<string>>();
  for (const u of units) {
    const s = new Set<string>();
    if (u.mode === "punch") {
      // DRIVERS have no work order of their own: they are counted wherever there are punches
      for (const p of punch) if (!u.workOrders.length || u.workOrders.includes(p.work_order)) s.add(p.month);
    } else for (const f of files) if (f.code === u.code) s.add(`${f.year}-${String(f.month).padStart(2, "0")}`);
    byUnit.set(u.code, s);
  }
  const all = [...new Set([...byUnit.values()].flatMap((s) => [...s]))].sort().reverse();
  return { units, byUnit, all };
}

export async function salaryByUnitMonth(months: string[]): Promise<UnitMonth[]> {
  const { units, byUnit } = await dataMonths();
  const out: UnitMonth[] = [];
  for (const mo of months) for (const u of units) {
    if (!byUnit.get(u.code)?.has(mo)) continue;
    const [y, m] = mo.split("-").map(Number);
    const ms = await monthSalary(u.code, y, m);
    if (!ms) continue;
    const ls = ms.rows.map((r) => r.line).filter((l): l is NonNullable<typeof l> => !!l);
    if (!ls.length) continue;
    const s = (f: (l: (typeof ls)[number]) => number) => Math.round(ls.reduce((a, l) => a + f(l), 0));
    out.push({ unit: u.code, month: mo, status: ms.run.status, people: ls.length, payableDays: s((l) => l.payableDays), lop: s((l) => l.lop),
      totalEarning: s((l) => l.totalEarning), net: s((l) => l.netAfterPt), pfEE: s((l) => l.pf), pfER: s((l) => l.pfEmployer), esiEE: s((l) => l.esi), esiER: s((l) => l.esiEmployer),
      bonus: s((l) => l.bonus), ctc: s((l) => l.ctc), ctcBilling: s((l) => l.ctcBilling) });
  }
  return out;
}

/** Active people per unit now, and joiners / leavers per month (from the joining and leaving dates). */
export async function headcount(months: string[]) {
  const d = db();
  const now = (await d.execute(sql`SELECT coalesce(u.code, '—') AS unit, count(*) FILTER (WHERE e.status = 'active')::int AS active, count(*) FILTER (WHERE e.status = 'left')::int AS left
    FROM employees e LEFT JOIN LATERAL (SELECT a.unit_id FROM assignments a WHERE a.employee_id = e.id ORDER BY a.valid_to IS NULL DESC, a.valid_from DESC LIMIT 1) a ON true
    LEFT JOIN units u ON u.id = a.unit_id GROUP BY 1 ORDER BY 1`)) as unknown as { unit: string; active: number; left: number }[];
  const flow = months.length ? (await d.execute(sql`SELECT m AS month,
      (SELECT count(*) FROM employees WHERE to_char(doj, 'YYYY-MM') = m)::int AS joined,
      (SELECT count(*) FROM employees WHERE status = 'left' AND to_char(dol, 'YYYY-MM') = m)::int AS left
    FROM unnest(${sql.raw(`ARRAY[${months.map((x) => `'${x.replace(/[^0-9-]/g, "")}'`).join(",")}]::text[]`)}) AS m ORDER BY m DESC`)) as unknown as { month: string; joined: number; left: number }[] : [];
  return { now, flow };
}
