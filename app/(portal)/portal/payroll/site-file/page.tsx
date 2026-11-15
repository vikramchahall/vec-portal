import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import SiteFileClient from "./SiteFileClient";

export const dynamic = "force-dynamic";

/** File-mode units (STP, HZL): the month's salary is the site's own Working Salary workbook. */
export default async function SiteFile({ searchParams }: { searchParams: Promise<{ unit?: string; month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const units = (await unitList()).filter((u) => u.mode === "file");
  const unit = units.find((u) => u.code === sp.unit)?.code ?? units[0]?.code ?? "";
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : d.toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const u = units.find((x) => x.code === unit);
  const [run] = u ? await db().select().from(schema.monthRuns).where(and(eq(schema.monthRuns.unitId, u.id), eq(schema.monthRuns.year, y), eq(schema.monthRuns.month, m))) : [];
  const [cur] = run ? await db().select({ fileName: schema.siteSalaryFiles.fileName, uploadedAt: schema.siteSalaryFiles.uploadedAt, uploadedBy: schema.siteSalaryFiles.uploadedBy })
    .from(schema.siteSalaryFiles).where(eq(schema.siteSalaryFiles.runId, run.id)) : [];
  return (
    <>
      <Crumbs items={[["Payroll"], ["Site salary file"]]} />
      <PageHead title="Site salary file" sub="STP and the HZL sites send their own Working Salary workbook. Upload it here; the portal reads every person's days, earnings, deductions and net from it by the column headings." />
      {cur ? <div className="alert info" style={{ marginBottom: 12 }}><Icon name="info" size="sm" /><div>
        {unit} · {month}: <b>{cur.fileName}</b> uploaded {cur.uploadedAt.toLocaleString("en-IN")} by {cur.uploadedBy}{run?.status !== "draft" ? ` — the month is ${run?.status}, reopen it to replace the file.` : ". Uploading again replaces it."}
      </div></div> : null}
      {units.length ? <SiteFileClient units={units.map((x) => ({ code: x.code, name: x.name }))} unit={unit} month={month} />
        : <div className="card"><div className="empty">No unit is set to "Site working-salary file" on Sites &amp; Units.</div></div>}
    </>
  );
}
