import { requireUser } from "@/lib/auth";
import { unitList } from "@/lib/employees";
import { Crumbs, PageHead } from "@/components/vec/ui";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  await requireUser();
  const units = await unitList();
  return (
    <>
      <Crumbs items={[["People"], ["Employee Directory", "/portal/employees"], ["Import from Excel"]]} />
      <PageHead title="Import employees from Excel" sub="Load the employee master from the monthly Working Salary files, unit by unit. Running it again later updates people instead of duplicating them." />
      <ImportClient units={units.map((u) => ({ code: u.code, siteName: u.siteName }))} />
    </>
  );
}
