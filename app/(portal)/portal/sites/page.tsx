import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { unitSummary } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import { SiteButton, TemplateButton, UnitButton } from "./SiteForms";

export const dynamic = "force-dynamic";

export default async function Sites() {
  const user = await requireUser();
  const owner = user.role === "owner";
  const d = db();
  const [sites, units, summary, templates] = await Promise.all([
    d.select().from(schema.sites).orderBy(asc(schema.sites.id)),
    d.select().from(schema.units).orderBy(asc(schema.units.sortOrder), asc(schema.units.id)),
    unitSummary(),
    d.select({ unitId: schema.excelTemplates.unitId, fileName: schema.excelTemplates.fileName, uploadedAt: schema.excelTemplates.uploadedAt }).from(schema.excelTemplates),
  ]);
  const active = new Map(summary.map((s) => [s.code, s.active]));
  const tpl = new Map(templates.map((t) => [t.unitId, t]));
  return (
    <>
      <Crumbs items={[["Operations"], ["Sites & Units"]]} />
      <PageHead title="Sites & units" sub={`${sites.length} sites · ${units.length} units`}>{owner ? <SiteButton /> : null}</PageHead>
      {sites.map((s) => {
        const us = units.filter((u) => u.siteId === s.id);
        return (
          <div className="card" key={s.id} style={{ marginBottom: 16 }}>
            <div className="card-h"><Icon name="factory" size="sm" />
              <div><h3>{s.name}</h3><div className="dim" style={{ fontSize: 12 }}>{s.code} · {s.state}{s.client ? ` · ${s.client}` : ""} · {s.billingModel === "per_employee" ? "rate per employee" : "% of bill"}</div></div>
              <span className="right row" style={{ gap: 6 }}>{owner ? <><SiteButton site={{ id: s.id, code: s.code, name: s.name, client: s.client ?? "", state: s.state, billingModel: s.billingModel }} /><UnitButton siteId={s.id} /></> : null}</span></div>
            {us.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Unit</th><th>Work order(s)</th><th>Attendance from</th><th>Excel template</th><th className="num">Active employees</th><th></th></tr></thead>
                <tbody>{us.map((u) => {
                  const t = tpl.get(u.id);
                  return (
                    <tr key={u.id}><td><b>{u.code}</b><div className="dim" style={{ fontSize: 11.5 }}>{u.name}</div></td>
                      <td className="mono">{u.workOrders.join(" · ") || "—"}</td><td>{u.mode === "punch" ? "Gate punch file" : "Site salary file"}</td>
                      <td>{t ? <><a href={`/portal/sites/template?unit=${u.id}`} title={`Uploaded ${t.uploadedAt.toLocaleDateString("en-IN")}`}>{t.fileName}</a></> : <span className="dim">Not uploaded</span>}
                        {owner ? <div className="mt8"><TemplateButton unitId={u.id} has={!!t} /></div> : null}</td>
                      <td className="num">{active.get(u.code) ?? 0}</td>
                      <td><span className="row" style={{ gap: 4 }}>{owner ? <UnitButton siteId={s.id} unit={{ id: u.id, siteId: s.id, code: u.code, name: u.name, workOrders: u.workOrders, mode: u.mode }} /> : null}
                        <Link href={`/portal/employees?unit=${u.code}`}>Employees <Icon name="chevR" size="sm" /></Link></span></td></tr>
                  );
                })}</tbody>
              </table></div>
            ) : <div className="card-b dim">No units yet{owner ? " — use Add unit." : "."}</div>}
          </div>
        );
      })}
      <div className="alert info"><Icon name="info" size="sm" /><div>The Excel template is the unit&apos;s own Working Salary workbook from a past month. Exports for that unit are filled into it, keeping its sheets, formulas and formatting.</div></div>
    </>
  );
}
