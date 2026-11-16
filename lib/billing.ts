import "server-only";
import { db, schema } from "@/lib/db";
import { salaryByUnitMonth, type UnitMonth } from "@/lib/reports";

/**
 * Billing & profitability per unit and month. Cost = the Working Salary's "CTC for billing" (earnings + employer
 * PF / ESIC / LWF + bonus, less salary on hold). What VEC earns depends on the unit's setting:
 *   per_employee — rate ₹ × people paid in the month (HMEL ETP / WB / drivers: ₹900)
 *   percent      — rate % of the salary cost (STP, HZL: 4%)
 * Expected bill = cost + expected earning. When the bill the client passed is entered, actual earning =
 * bill passed − cost, and the difference from the expected earning is shown.
 */
export type BillingRow = UnitMonth & {
  model: string; rate: number; expectedEarning: number; expectedBill: number;
  bill: { amount: number; billNo: string | null; billDate: string | null; passedOn: string | null; note: string | null } | null;
  actualEarning: number | null; difference: number | null;
};

export const expected = (model: string, rate: number, r: Pick<UnitMonth, "people" | "ctcBilling">) =>
  Math.round(model === "percent" ? (r.ctcBilling * rate) / 100 : r.people * rate);

export async function billingFor(months: string[]): Promise<BillingRow[]> {
  const d = db();
  const [units, bills, rows] = await Promise.all([d.select().from(schema.units), d.select().from(schema.clientBills), salaryByUnitMonth(months)]);
  return rows.map((r) => {
    const u = units.find((x) => x.code === r.unit)!;
    const [y, m] = r.month.split("-").map(Number);
    const b = bills.find((x) => x.unitId === u.id && x.year === y && x.month === m);
    const rate = Number(u.billingRate), exp = expected(u.billingModel, rate, r);
    const amount = b ? Number(b.amount) : null;
    return {
      ...r, model: u.billingModel, rate, expectedEarning: exp, expectedBill: r.ctcBilling + exp,
      bill: b ? { amount: amount!, billNo: b.billNo, billDate: b.billDate, passedOn: b.passedOn, note: b.note } : null,
      actualEarning: amount === null ? null : Math.round(amount - r.ctcBilling),
      difference: amount === null ? null : Math.round(amount - r.ctcBilling - exp),
    };
  });
}
