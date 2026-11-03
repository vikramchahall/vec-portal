import { requireUser } from "@/lib/auth";
import { nextVecId, unitList } from "@/lib/employees";
import { Crumbs, PageHead } from "@/components/vec/ui";
import EmployeeForm from "../EmployeeForm";

export default async function NewEmployee({ searchParams }: { searchParams: Promise<{ card?: string; unit?: string }> }) {
  await requireUser();
  const [units, vecId, sp] = await Promise.all([unitList(), nextVecId(), searchParams]);
  return (
    <>
      <Crumbs items={[["People"], ["Employee Directory", "/portal/employees"], ["Add employee"]]} />
      <PageHead title="Add employee" sub={`New VEC ID on save: ${vecId}`} />
      <EmployeeForm id={null} units={units} secrets={{ aadhaar: null, pan: null, account: null }}
        initial={{ cardNo: sp.card, unitCode: sp.unit, status: "active", woWeekday: "Sun", pfMember: true, esiMember: false, bonusMonthly: true, hra: 0, special: 0, conveyance: 0, others: 0 }} />
    </>
  );
}
