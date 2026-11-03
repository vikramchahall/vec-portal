import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployee } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Alert, Crumbs, StatusBadge, fmtDate, initials, inr } from "@/components/vec/ui";
import RevealButton from "../RevealButton";

const TABS = [["personal", "Personal"], ["employment", "Employment"], ["statutory", "Statutory"], ["bank", "Bank"], ["history", "History & transfers"]] as const;

type Row = [string, React.ReactNode, React.ReactNode?];
function KV({ rows }: { rows: Row[] }) {
  return (
    <div className="kv">{rows.map(([k, v, extra]) => (
      <div className="kv-row" key={k}><div className="k">{k}</div>
        <div className={`v ${v === null || v === undefined || v === "" ? "na" : ""}`}>{v === null || v === undefined || v === "" ? "-NA-" : v}</div>
        <div>{extra}</div></div>))}
    </div>
  );
}
function Sect({ title, edit, rows }: { title: string; edit?: string; rows: Row[] }) {
  return (
    <div className="sect">
      <div className="sect-h"><h2>{title}</h2>{edit ? <Link className="link-btn" href={edit}>Edit</Link> : null}</div>
      <KV rows={rows} />
    </div>
  );
}

export default async function Profile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getEmployee(Number(id));
  if (!data) notFound();
  const { e, current, pay, cards, assigns, pays, history, minWage, card } = data;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "personal";
  const edit = `/portal/employees/${e.id}/edit`;
  const owner = user.role === "owner";
  const masked = (last4: string | null, len: number) => (last4 ? "X".repeat(Math.max(0, len - 4)).replace(/(.{4})/g, "$1 ").trim() + " " + last4 : null);
  const gross = pay ? pay.basicDa + pay.hra + pay.special + pay.conveyance + pay.others : null;

  let body: React.ReactNode;
  if (tab === "personal") body = (<>
    <Sect title="Identity" edit={edit} rows={[
      ["Full name", e.name], ["Father's name", e.fatherName], ["Date of birth", fmtDate(e.dob) === "—" ? null : fmtDate(e.dob)], ["Gender", e.gender],
      ["Aadhaar", e.aadhaarLast4 ? (owner ? <RevealButton id={e.id} field="aadhaar" masked={masked(e.aadhaarLast4, 12)!} /> : masked(e.aadhaarLast4, 12)) : null],
      ["PAN", e.panLast4 ? (owner ? <RevealButton id={e.id} field="pan" masked={"XXXXXX" + e.panLast4} /> : "XXXXXX" + e.panLast4) : null],
    ]} />
    <Sect title="Contact" edit={edit} rows={[["Mobile", e.mobile], ["Address", e.address], ["Notes", e.notes]]} />
  </>);
  else if (tab === "employment") body = (<>
    <Sect title="Current assignment" edit={edit} rows={[
      ["Site / unit", current ? `${current.siteName} · ${current.unitCode} — ${current.unitName}` : null],
      ["Register no.", current?.registerNo], ["Designation", current?.designation],
      ["Category", current?.category ? `${current.category}${minWage ? ` — minimum wage ${inr(minWage)}` : ""}` : null],
      ["Date of joining", e.doj ? fmtDate(e.doj) : null], ["Usual weekly off", current?.woWeekday], ["Driver rules", current?.isDriver ? "Yes" : "No"],
      ["Gate card", card ? `${card.cardNo} — linked since ${fmtDate(card.validFrom)}` : null],
    ]} />
    <Sect title="Pay structure" edit={edit} rows={pay ? [
      ["Effective from", fmtDate(pay.effectiveFrom)], ["Basic + DA", inr(pay.basicDa)], ["HRA", inr(pay.hra)],
      ["Special / conveyance / others", `${inr(pay.special)} / ${inr(pay.conveyance)} / ${inr(pay.others)}`], ["Monthly gross", inr(gross)],
      ["Flags", <span key="f" className="row wrap">
        <span className={`badge ${e.pfMember ? "b-green" : "b-grey"}`}>{e.pfMember ? "PF" : "No PF"}</span>
        <span className={`badge ${e.esiMember ? "b-green" : "b-grey"}`}>{e.esiMember ? "ESIC" : "No ESIC"}</span>
        <span className={`badge ${e.bonusMonthly ? "b-green" : "b-grey"}`}>{e.bonusMonthly ? "Monthly bonus" : "Annual bonus"}</span></span>],
    ] : [["Structure", null]]} />
    {pay && minWage && pay.basicDa < minWage ? <Alert kind="warn">Basic + DA {inr(pay.basicDa)} is below the {current?.category} minimum wage {inr(minWage)}.</Alert> : null}
  </>);
  else if (tab === "statutory") body = (
    <Sect title="PF / ESIC" edit={edit} rows={[["UAN", e.uan], ["PF account no.", e.pfAccount], ["PF member", e.pfMember ? "Yes" : "No"], ["ESIC IP no.", e.esicIp], ["ESIC member", e.esiMember ? "Yes" : "No"]]} />
  );
  else if (tab === "bank") body = (
    <Sect title="Salary account" edit={edit} rows={[
      ["Bank", e.bankName],
      ["Account no.", e.accountLast4 ? (owner ? <RevealButton id={e.id} field="account" masked={"XXXXXXXX" + e.accountLast4} /> : "XXXXXXXX" + e.accountLast4) : null],
      ["IFSC", e.ifsc], ["Account holder", e.name],
    ]} />
  );
  else body = (<>
    <div className="grid g2">
      <div className="card"><div className="card-h"><h3>Gate cards</h3></div><div className="tbl-wrap"><table className="tbl compact">
        <thead><tr><th>Card</th><th>Unit</th><th>From</th><th>To</th></tr></thead>
        <tbody>{cards.map((c) => <tr key={c.id}><td className="mono">{c.cardNo}</td><td>{c.unitCode ?? "—"}</td><td>{fmtDate(c.validFrom)}</td><td>{c.validTo ? fmtDate(c.validTo) : <span className="badge b-green">Current</span>}</td></tr>)}</tbody>
      </table></div></div>
      <div className="card"><div className="card-h"><h3>Pay structures</h3></div><div className="tbl-wrap"><table className="tbl compact">
        <thead><tr><th>From</th><th className="num">Basic+DA</th><th className="num">HRA</th><th className="num">Gross</th></tr></thead>
        <tbody>{pays.map((p) => <tr key={p.id}><td>{fmtDate(p.effectiveFrom)}</td><td className="num">{inr(p.basicDa)}</td><td className="num">{inr(p.hra)}</td><td className="num">{inr(p.basicDa + p.hra + p.special + p.conveyance + p.others)}</td></tr>)}</tbody>
      </table></div></div>
    </div>
    <div className="card mt16"><div className="card-h"><h3>Units</h3></div><div className="tbl-wrap"><table className="tbl compact">
      <thead><tr><th>Unit</th><th>Designation</th><th>Category</th><th>From</th><th>To</th></tr></thead>
      <tbody>{assigns.map((a) => <tr key={a.id}><td>{a.unitCode}</td><td>{a.designation ?? "—"}</td><td>{a.category ?? "—"}</td><td>{fmtDate(a.validFrom)}</td><td>{a.validTo ? fmtDate(a.validTo) : <span className="badge b-green">Current</span>}</td></tr>)}</tbody>
    </table></div></div>
    <div className="card mt16"><div className="card-h"><h3>Change log</h3></div>
      {history.length === 0 ? <div className="card-b dim">No changes recorded.</div> : <ul className="list">{history.map((h) => (
        <li key={h.id}><div className="ic"><Icon name={h.action === "reveal" ? "eye" : h.action === "create" ? "userPlus" : "edit"} size="sm" /></div>
          <div><div className="t">{h.action === "reveal" ? `Full ${(h.detail as { field?: string })?.field ?? "number"} viewed` : Array.isArray(h.detail) ? (h.detail as string[]).join(" · ") : h.action}</div>
            <div className="s">{h.actor} · {h.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</div></div></li>))}</ul>}
    </div>
  </>);

  return (
    <>
      <Crumbs items={[["People"], ["Employee Directory", "/portal/employees"], [e.name]]} />
      {sp.saved ? <div style={{ marginBottom: 12 }}><Alert kind="ok">Saved.</Alert></div> : null}
      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div className="row gap16 wrap">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 18, borderRadius: 10 }}>{initials(e.name)}</div>
          <div>
            <h1>{e.name}</h1>
            <div className="muted">{[current?.designation, current?.category, current ? `${current.siteName} / ${current.unitCode}` : null].filter(Boolean).join(" · ") || "No unit yet"}</div>
            <div className="row mt8 wrap">
              <StatusBadge status={e.status} />
              <span className="badge b-grey mono">{e.vecId}</span>
              {card ? <span className="badge b-grey mono">Card {card.cardNo}</span> : null}
              {e.doj ? <span className="badge b-grey">Joined {fmtDate(e.doj)}</span> : null}
            </div>
          </div>
          <div className="ml-auto row"><Link className="btn primary" href={edit}><Icon name="edit" size="sm" />Edit</Link></div>
        </div>
      </div>
      <div className="tabs">{TABS.map(([k, label]) => <Link key={k} className={`tab ${tab === k ? "on" : ""}`} href={`/portal/employees/${e.id}?tab=${k}`}>{label}</Link>)}</div>
      <div className="mt16">{body}</div>
    </>
  );
}
