import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEmployees, statusCounts, unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, StatusBadge, fmtDate, initials } from "@/components/vec/ui";

type SP = { q?: string; unit?: string; status?: string; missing?: string; page?: string };

export default async function Directory({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const [list, counts, units] = await Promise.all([
    listEmployees({ q: sp.q, unit: sp.unit, status, missing: sp.missing, page: Number(sp.page) || 1 }),
    statusCounts(), unitList(),
  ]);
  const qs = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const m = { ...sp, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v));
    return `/portal/employees?${p.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(list.total / list.size));
  const tabs: [string, string, number][] = [["all", "All", counts.all], ["active", "Active", counts.active], ["on_hold", "On hold", counts.on_hold], ["left", "Left", counts.left]];

  return (
    <>
      <Crumbs items={[["People"], ["Employee Directory"]]} />
      <PageHead title="Employee directory" sub={`One master for all sites — ${counts.all} employees · ${counts.active} active`}>
        <Link className="btn" href="/portal/employees/import"><Icon name="upload" size="sm" />Import Excel</Link>
        <a className="btn" href={`/portal/employees/export${sp.unit ? `?unit=${sp.unit}` : ""}`}><Icon name="download" size="sm" />Export Master Sheet</a>
        <Link className="btn primary" href="/portal/employees/new"><Icon name="userPlus" size="sm" />Add employee</Link>
      </PageHead>
      <div className="card">
        <div className="tabs" style={{ padding: "0 12px" }}>
          {tabs.map(([k, label, n]) => (
            <Link key={k} className={`tab ${status === k ? "on" : ""}`} href={qs({ status: k, page: undefined })}>{label} <span className="count">{n}</span></Link>
          ))}
        </div>
        <form className="toolbar" action="/portal/employees">
          <input type="hidden" name="status" value={status} />
          <label className="search-in"><Icon name="search" size="sm" /><input name="q" defaultValue={sp.q} placeholder="Name, VEC ID, card no., UAN, mobile" /></label>
          <select className="select" name="unit" defaultValue={sp.unit ?? ""}>
            <option value="">All units</option>
            {units.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.siteName}</option>)}
          </select>
          <select className="select" name="missing" defaultValue={sp.missing ?? ""}>
            <option value="">Any record</option>
            <option value="bank">Missing bank details</option>
            <option value="uan">PF member without UAN</option>
            <option value="aadhaar">Aadhaar not recorded</option>
          </select>
          <button className="btn" type="submit"><Icon name="filter" size="sm" />Apply</button>
          {(sp.q || sp.unit || sp.missing) ? <Link className="btn ghost" href={`/portal/employees?status=${status}`}>Clear</Link> : null}
        </form>
        {list.rows.length === 0 ? (
          <div className="empty"><div className="big"><Icon name="users" size="lg" /></div><b>No employees match</b>
            <p className="muted">Change the filters, or <Link href="/portal/employees/import">import from Excel</Link>.</p></div>
        ) : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Employee</th><th>Card no.</th><th>Designation</th><th>Category</th><th>Site / unit</th><th>DOJ</th><th>Mobile</th><th>UAN</th><th>Bank</th><th>Status</th></tr></thead>
            <tbody>{list.rows.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/portal/employees/${e.id}`} className="person" style={{ color: "var(--text)" }}>
                  <div className="avatar">{initials(e.name)}</div><div>{e.name}<small>{e.vecId}</small></div></Link></td>
                <td className="mono">{e.cardNo ?? "—"}</td>
                <td>{e.designation ?? "—"}</td><td>{e.category ?? "—"}</td>
                <td>{e.siteName ? `${e.siteName.split(" ")[0]} · ${e.unitCode}` : "—"}</td>
                <td>{fmtDate(e.doj)}</td><td>{e.mobile ?? <span className="empty-cell">—</span>}</td>
                <td className="mono">{e.uan ?? <span className="badge b-amber">Missing</span>}</td>
                <td>{e.accountLast4 && e.ifsc ? <span className="badge b-green">••{e.accountLast4}</span> : <span className="badge b-amber">Missing</span>}</td>
                <td><StatusBadge status={e.status} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
        <div className="pager">
          Showing {list.total ? (list.page - 1) * list.size + 1 : 0}–{Math.min(list.page * list.size, list.total)} of {list.total}
          <span className="ml-auto" />
          {list.page > 1 ? <Link className="pg" href={qs({ page: String(list.page - 1) })}><Icon name="chevL" size="sm" /></Link> : null}
          <span className="pg on">{list.page}</span><span>of {pages}</span>
          {list.page < pages ? <Link className="pg" href={qs({ page: String(list.page + 1) })}><Icon name="chevR" size="sm" /></Link> : null}
        </div>
      </div>
    </>
  );
}
