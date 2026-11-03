import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { recentActivity, statusCounts, unitSummary } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Alert, Crumbs, PageHead } from "@/components/vec/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const [counts, units, activity, sp] = await Promise.all([statusCounts(), unitSummary(), recentActivity(), searchParams]);
  const gaps = units.reduce((a, u) => ({ bank: a.bank + u.noBank, uan: a.uan + u.noUan, aadhaar: a.aadhaar + u.noAadhaar }), { bank: 0, uan: 0, aadhaar: 0 });
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <Crumbs items={[["Dashboard"]]} />
      <PageHead title={`${greet}, ${user.name.split(" ")[0]}`} sub="Employee master — all sites in one place. Attendance and payroll arrive in the next build steps.">
        <Link className="btn" href="/portal/employees/import"><Icon name="upload" size="sm" />Import from Excel</Link>
        <Link className="btn primary" href="/portal/employees/new"><Icon name="userPlus" size="sm" />Add employee</Link>
      </PageHead>
      {sp.denied ? <div style={{ marginBottom: 16 }}><Alert kind="warn">That page is for the owner account only.</Alert></div> : null}
      {counts.all === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}><div className="empty">
          <div className="big"><Icon name="users" size="lg" /></div>
          <h2>No employees yet</h2>
          <p className="muted" style={{ maxWidth: 520, margin: "8px auto 0" }}>Start by importing the October Working Salary files of each unit — names, cards, structures, bank and UAN come in at once.</p>
          <Link className="btn primary mt16" href="/portal/employees/import"><Icon name="upload" size="sm" />Import from Excel</Link>
        </div></div>
      ) : null}
      <div className="grid g5">
        <Kpi icon="users" label="Total employees" value={counts.all} meta={`${counts.left} left · ${counts.on_hold} on hold`} />
        <Kpi icon="checkCircle" label="Active" value={counts.active} meta="across all units" />
        <Kpi icon="landmark" label="Missing bank details" value={gaps.bank} meta="salary would be held" warn={gaps.bank > 0} href="/portal/employees?missing=bank" />
        <Kpi icon="idcard" label="PF member without UAN" value={gaps.uan} meta="PF cannot be filed" warn={gaps.uan > 0} href="/portal/employees?missing=uan" />
        <Kpi icon="file" label="Aadhaar not recorded" value={gaps.aadhaar} meta="needed for PF / ESIC" warn={gaps.aadhaar > 0} href="/portal/employees?missing=aadhaar" />
      </div>
      <div className="grid g3 mt16">
        <div className="card span2">
          <div className="card-h"><h3>Units</h3><Link className="right" href="/portal/sites">Sites &amp; units <Icon name="chevR" size="sm" /></Link></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Unit</th><th>Site</th><th>Attendance from</th><th className="num">Active</th><th className="num">No bank</th><th className="num">No UAN</th><th className="num">No Aadhaar</th><th></th></tr></thead>
            <tbody>{units.map((u) => (
              <tr key={u.code}>
                <td><b>{u.code}</b><div className="dim" style={{ fontSize: 11.5 }}>{u.name}</div></td>
                <td>{u.site}</td><td>{u.mode === "punch" ? "Gate punch file" : "Site salary file"}</td>
                <td className="num">{u.active}</td>
                <td className="num">{u.noBank ? <span className="badge b-amber">{u.noBank}</span> : "0"}</td>
                <td className="num">{u.noUan ? <span className="badge b-amber">{u.noUan}</span> : "0"}</td>
                <td className="num">{u.noAadhaar || "0"}</td>
                <td><Link href={`/portal/employees?unit=${u.code}`}>Open <Icon name="chevR" size="sm" /></Link></td>
              </tr>))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Recent activity</h3></div>
          {activity.length === 0 ? <div className="card-b dim">Nothing yet.</div> : (
            <ul className="list">{activity.map((a) => (
              <li key={a.id}><div className="ic"><Icon name={a.action === "login" ? "key" : a.action.startsWith("import") ? "upload" : "edit"} size="sm" /></div>
                <div><div className="t">{describe(a.action, a.entity, a.entityId)}</div>
                  <div className="s">{a.actor} · {a.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</div></div></li>))}
            </ul>)}
        </div>
      </div>
    </>
  );
}

function describe(action: string, entity: string, id: string | null) {
  if (action === "login") return "Signed in";
  if (action === "import") return "Employees imported from Excel";
  if (action === "reveal") return `Viewed a full ID number (employee ${id})`;
  return `${action[0].toUpperCase()}${action.slice(1)} ${entity}${id ? " " + id : ""}`;
}

function Kpi({ icon, label, value, meta, warn, href }: { icon: string; label: string; value: number; meta: string; warn?: boolean; href?: string }) {
  const body = (
    <div className="card kpi" style={{ height: "100%" }}>
      <div className="lbl"><Icon name={icon} size="sm" />{label}</div>
      <div className="val" style={warn ? { color: "var(--warn)" } : undefined}>{value.toLocaleString("en-IN")}</div>
      <div className="meta">{meta}</div>
    </div>
  );
  return href ? <Link href={href} style={{ color: "inherit" }}>{body}</Link> : body;
}
