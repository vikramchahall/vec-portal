import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployee, unitList } from "@/lib/employees";
import { Crumbs, PageHead } from "@/components/vec/ui";
import EmployeeForm from "../../EmployeeForm";

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [data, units] = await Promise.all([getEmployee(Number(id)), unitList()]);
  if (!data) notFound();
  const { e, current, pay, card } = data;
  return (
    <>
      <Crumbs items={[["People"], ["Employee Directory", "/portal/employees"], [e.name, `/portal/employees/${e.id}`], ["Edit"]]} />
      <PageHead title={`Edit ${e.name}`} sub={`${e.vecId} · changes are logged`} />
      <EmployeeForm id={e.id} units={units}
        secrets={{ aadhaar: e.aadhaarLast4, pan: e.panLast4, account: e.accountLast4 }}
        initial={{
          name: e.name, fatherName: e.fatherName, dob: e.dob, gender: e.gender, mobile: e.mobile, address: e.address,
          uan: e.uan, pfAccount: e.pfAccount, esicIp: e.esicIp, pfMember: e.pfMember, esiMember: e.esiMember, bonusMonthly: e.bonusMonthly,
          bankName: e.bankName, ifsc: e.ifsc, status: e.status, doj: e.doj, dol: e.dol, notes: e.notes,
          cardNo: card?.cardNo, unitCode: current?.unitCode, registerNo: current?.registerNo, designation: current?.designation,
          category: current?.category, woWeekday: current?.woWeekday, isDriver: current?.isDriver,
          basicDa: pay?.basicDa, hra: pay?.hra, special: pay?.special, conveyance: pay?.conveyance, others: pay?.others,
        }} />
    </>
  );
}
