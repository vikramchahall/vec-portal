import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { monthAttendance, type MonthAttendance, type PersonMonth } from "@/lib/codes";
import { calcSalary, salarySettings, type SalaryLine } from "@/lib/engine/salary";

export type PayRow = {
  p: PersonMonth; line: SalaryLine | null; problem: string | null;
  regNo: string | null; category: string | null; doj: string | null; isDriver: boolean;
  structure: { basicDa: number; hra: number; special: number; conveyance: number; others: number } | null;
  pf: boolean; esi: boolean; bonusMonthly: boolean;
  bank: { name: string | null; last4: string | null; ifsc: string | null }; uan: string | null; esicIp: string | null; pfAccount: string | null;
  adj: { otDays: number; hold: number; leaveEncashment: number; reason: string } | null;
};
export type MonthSalary = MonthAttendance & { rows: PayRow[]; totals: Record<string, number>; settings: ReturnType<typeof salarySettings> };

const SUM_KEYS = ["payableDays", "gross", "hpAmount", "totalEarning", "pf", "esi", "lwf", "bonus", "net", "pt", "netAfterPt", "pfEmployer", "esiEmployer", "lwfEmployer", "ctc", "ctcBilling"] as const;

/** Working Salary for one unit and month, from the day codes and each person's pay structure. */
export async function monthSalary(unitCode: string, year: number, month: number): Promise<MonthSalary | null> {
  const ma = await monthAttendance(unitCode, year, month);
  if (!ma) return null;
  const settings = salarySettings(ma.days);
  const ids = ma.persons.filter((p) => p.known).map((p) => p.employeeId!);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(ma.days).padStart(2, "0")}`;
  const info = ids.length ? (await db().execute(sql`SELECT e.id, e.pf_member, e.esi_member, e.bonus_monthly, e.bank_name, e.account_last4, e.ifsc, e.uan, e.esic_ip, e.pf_account, e.doj::text AS doj,
      a.register_no, a.category, a.is_driver, ps.basic_da, ps.hra, ps.special, ps.conveyance, ps.others
    FROM employees e
    LEFT JOIN LATERAL (SELECT * FROM assignments a WHERE a.employee_id = e.id AND a.unit_id = ${ma.unit.id} ORDER BY a.valid_from DESC LIMIT 1) a ON true
    LEFT JOIN LATERAL (SELECT * FROM pay_structures p WHERE p.employee_id = e.id AND p.effective_from <= ${monthEnd}::date ORDER BY p.effective_from DESC LIMIT 1) ps ON true
    WHERE e.id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)) as unknown as Record<string, unknown>[] : [];
  const byId = new Map(info.map((r) => [Number(r.id), r]));
  const adjRows = await db().select().from(schema.payAdjustments).where(eq(schema.payAdjustments.runId, ma.run.id));
  const adjBy = new Map(adjRows.map((a) => [a.employeeId, { otDays: Number(a.otDays), hold: a.hold, leaveEncashment: a.leaveEncashment, reason: a.reason }]));

  const rows: PayRow[] = ma.persons.filter((p) => p.known && p.b).map((p) => {
    const r = byId.get(p.employeeId!) ?? {};
    const structure = r.basic_da !== null && r.basic_da !== undefined
      ? { basicDa: Number(r.basic_da), hra: Number(r.hra ?? 0), special: Number(r.special ?? 0), conveyance: Number(r.conveyance ?? 0), others: Number(r.others ?? 0) } : null;
    // driver pay rules (no bonus) follow the designation: a helper on plant pay in the driver group keeps bonus and ESIC
    const isDriver = Boolean(r.is_driver);
    const base = {
      p, regNo: (r.register_no as string) ?? null, category: (r.category as string) ?? null, doj: (r.doj as string) ?? null, isDriver, structure,
      pf: Boolean(r.pf_member), esi: Boolean(r.esi_member), bonusMonthly: Boolean(r.bonus_monthly),
      bank: { name: (r.bank_name as string) ?? null, last4: (r.account_last4 as string) ?? null, ifsc: (r.ifsc as string) ?? null },
      uan: (r.uan as string) ?? null, esicIp: (r.esic_ip as string) ?? null, pfAccount: (r.pf_account as string) ?? null,
      adj: adjBy.get(p.employeeId!) ?? null,
    };
    if (!structure) return { ...base, line: null, problem: "No pay structure" };
    const line = calcSalary({
      structure: { basicDa: structure.basicDa, hra: structure.hra, special: structure.special, conveyance: structure.conveyance + structure.others },
      payableDays: p.b!.counts.payable, lopDays: p.b!.counts.X, hpDays: p.b!.counts.HP,
      // the driver group's sheets pay no annual bonus to anyone (a monthly bonus still applies where flagged)
      pf: base.pf, esi: base.esi, bonusMonthly: base.bonusMonthly && !isDriver, annualBonus: !isDriver && ma.unit.code !== "DRIVERS",
      otDays: base.adj?.otDays ?? 0, hold: base.adj?.hold ?? 0, leaveEncashment: base.adj?.leaveEncashment ?? 0,
    }, settings);
    return { ...base, line, problem: null };
  });
  const totals = Object.fromEntries(SUM_KEYS.map((k) => [k, rows.reduce((s, r) => s + (r.line ? r.line[k] : 0), 0)]));
  totals.people = rows.length;
  return { ...ma, rows, totals, settings };
}
