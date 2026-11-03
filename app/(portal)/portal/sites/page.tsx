import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { unitSummary, unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";

export default async function Sites() {
  await requireUser();
  const [units, summary] = await Promise.all([unitList(), unitSummary()]);
  const active = new Map(summary.map((s) => [s.code, s.active]));
  const sites = [...new Set(units.map((u) => u.siteName))];
  return (
    <>
      <Crumbs items={[["Operations"], ["Sites & Units"]]} />
      <PageHead title="Sites & units" sub={`${sites.length} sites · ${units.length} units`} />
      {sites.map((s) => {
        const us = units.filter((u) => u.siteName === s);
        return (
          <div className="card" key={s} style={{ marginBottom: 16 }}>
            <div className="card-h"><Icon name="factory" size="sm" /><h3>{s}</h3><span className="right dim">{us[0].siteState}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Unit</th><th>Work order(s)</th><th>Attendance from</th><th className="num">Active employees</th><th></th></tr></thead>
              <tbody>{us.map((u) => (
                <tr key={u.code}><td><b>{u.code}</b><div className="dim" style={{ fontSize: 11.5 }}>{u.name}</div></td>
                  <td className="mono">{u.workOrders.join(" · ") || "—"}</td><td>{u.mode === "punch" ? "Gate punch file" : "Site salary file"}</td>
                  <td className="num">{active.get(u.code) ?? 0}</td><td><Link href={`/portal/employees?unit=${u.code}`}>Employees <Icon name="chevR" size="sm" /></Link></td></tr>))}</tbody>
            </table></div>
          </div>
        );
      })}
    </>
  );
}
