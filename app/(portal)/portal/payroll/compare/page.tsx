import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { unitList } from "@/lib/employees";
import { Crumbs, PageHead } from "@/components/vec/ui";
import CompareClient from "./CompareClient";

export default async function Compare({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [units, months] = await Promise.all([unitList(), punchMonths()]);
  const codes = units.filter((u) => u.mode === "punch").map((u) => u.code);
  const monthList = [...new Set([sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7), ...months.map((x) => x.month)])];
  return (
    <>
      <Crumbs items={[["Payroll"], ["Working Salary", "/portal/payroll/working-salary"], ["Compare with Excel"]]} />
      <PageHead title="Compare with Excel" sub="Upload the Working Salary made by hand for the same unit and month. Everyone whose rupees differ is listed with the input that causes it." />
      <CompareClient units={codes} months={monthList} unit={sp.unit && codes.includes(sp.unit) ? sp.unit : codes[0] ?? ""} month={monthList[0]} />
    </>
  );
}
