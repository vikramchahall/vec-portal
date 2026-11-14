import { requireUser } from "@/lib/auth";
import { punchMonths } from "@/lib/attendance";
import { statutoryGroups, statutoryMonth, EPS_CEILING } from "@/lib/statutory";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, inr } from "@/components/vec/ui";

export const dynamic = "force-dynamic";

const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const STATUS: Record<string, string> = { draft: "b-grey", approved: "b-blue", locked: "b-lock" };

export default async function Statutory({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const months = await punchMonths();
  const month = sp.month ?? months[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const groups = await statutoryGroups();
  const data = (await Promise.all(groups.map((g) => statutoryMonth(g.group, y, m)))).filter((x) => x && x.rows.length);
  const all = data.reduce((a, s) => ({ pf: a.pf + s!.totals.pfEE + s!.totals.pfER, esi: a.esi + s!.totals.esiEE + s!.totals.esiER }), { pf: 0, esi: 0 });

  return (
    <>
      <Crumbs items={[["Statutory & Compliance"], ["PF / ESIC"]]} />
      <PageHead title="PF / ESIC" sub={`From the Working Salary of each unit. EPF and EPS wages up to ₹${EPS_CEILING.toLocaleString("en-IN")}; ESIC wages = total earning + monthly bonus.`} />
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" name="month" defaultValue={month}>
          {[...new Set([month, ...months.map((x) => x.month)])].map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
        <span className="ml-auto dim" style={{ fontSize: 12.5 }}>{data.length ? <>All establishments: PF <b>{inr(all.pf)}</b> · ESIC <b>{inr(all.esi)}</b></> : null}</span>
      </form>
      {!data.length ? <div className="card"><div className="empty">No salary for {monthLabel(month)} yet.</div></div> : null}
      {data.map((s) => {
        const t = s!.totals;
        const q = `group=${s!.group}&month=${month}`;
        const pfPeople = s!.rows.filter((r) => r.pf).length, esiPeople = s!.rows.filter((r) => r.esi).length;
        return (
          <div className="card" key={s!.group} style={{ marginBottom: 16 }}>
            <div className="card-h"><Icon name="shield" size="sm" />
              <div><h3>{s!.group}</h3><div className="row wrap" style={{ gap: 6, marginTop: 4 }}>{s!.units.map((u) => <span key={u.code} className={`badge ${STATUS[u.status] ?? "b-grey"}`}>{u.code} · {u.status}</span>)}</div></div>
              <span className="right row wrap" style={{ gap: 6 }}>
                <a className="btn" href={`/portal/statutory/export?${q}&kind=combined`}><Icon name="download" size="sm" />Combined EPF-ESIC .xlsx</a>
                <a className="btn" href={`/portal/statutory/export?${q}&kind=ecr`}><Icon name="fileText" size="sm" />EPFO ECR .txt</a>
                <a className="btn" href={`/portal/statutory/export?${q}&kind=esic`}><Icon name="table" size="sm" />ESIC upload .xls</a>
              </span></div>
            <div className="card-b row wrap" style={{ gap: 28 }}>
              {[["PF members", String(pfPeople)], ["EPF wages", inr(t.epfWages)], ["EPF employee 12%", inr(t.pfEE)], ["EPF employer 13%", inr(t.pfER)], ["of which EPS 8.33%", inr(t.eps)],
                ["ESIC members", String(esiPeople)], ["ESIC wages", inr(t.esicWages)], ["ESIC 0.75% + 3.25%", inr(t.esiEE + t.esiER)]].map(([l, v]) => (
                <div key={l}><div className="dim" style={{ fontSize: 12 }}>{l}</div><div style={{ font: "600 17px var(--display)" }}>{v}</div></div>))}
            </div>
            {s!.warnings.length ? <div className="card-b" style={{ paddingTop: 0 }}>{s!.warnings.map((w) => <div key={w} className="alert warn" style={{ marginTop: 8 }}><Icon name="alert" size="sm" /><div>{w}</div></div>)}</div> : null}
          </div>
        );
      })}
    </>
  );
}
