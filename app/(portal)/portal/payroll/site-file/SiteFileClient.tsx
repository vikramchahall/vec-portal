"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { previewSiteAction, saveSiteAction, type SitePreview } from "./actions";
import { Icon } from "@/components/vec/Icon";

const inr = (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`;

export default function SiteFileClient({ units, unit: u0, month: m0 }: { units: { code: string; name: string }[]; unit: string; month: string }) {
  const router = useRouter();
  const [unit, setUnit] = useState(u0), [month, setMonth] = useState(m0);
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<SitePreview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const form = () => { const fd = new FormData(); fd.set("unit", unit); fd.set("month", month); fd.set("file", file!); if (confirm) fd.set("confirmMonth", "1"); return fd; };
  const go = (q: { unit?: string; month?: string }) => router.push(`/portal/payroll/site-file?unit=${q.unit ?? unit}&month=${q.month ?? month}`);

  return (
    <>
      <div className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" value={unit} onChange={(e) => { setUnit(e.target.value); setPv(null); go({ unit: e.target.value }); }}>{units.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}</select>
        <input className="input" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPv(null); go({ month: e.target.value }); }} style={{ width: 170 }} />
        <label className="btn" style={{ cursor: "pointer" }}><Icon name="upload" size="sm" />{file ? file.name : "Choose the site's Working Salary file…"}
          <input type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; setFile(f); setPv(null); setMsg(null);
            if (f) start(async () => { setConfirm(false); const fd = new FormData(); fd.set("unit", unit); fd.set("month", month); fd.set("file", f); const r = await previewSiteAction(fd); if (r.error) setMsg({ ok: false, text: r.error }); else setPv(r.preview!); }); }} /></label>
        {pending && !pv ? <span className="dim">Reading…</span> : null}
      </div>
      {msg ? <div className={`alert ${msg.ok ? "ok" : "err"}`} style={{ marginBottom: 12 }}><Icon name={msg.ok ? "checkCircle" : "xCircle"} size="sm" /><div>{msg.text}</div></div> : null}
      {pv ? (
        <div className="card">
          <div className="card-h"><Icon name="table" size="sm" /><h3>{pv.sheet}</h3><span className="dim">{pv.people.length} people · {pv.days || "?"} days</span>
            <span className="right row" style={{ gap: 8 }}>
              <button className="btn primary" disabled={pending} onClick={() => start(async () => {
                const r = await saveSiteAction(form());
                if (r.error) { setMsg({ ok: false, text: r.error }); if (r.monthWarning) setConfirm(true); }
                else { setMsg({ ok: true, text: `Saved ${r.rows} people for ${unit}${r.added ? `; ${r.added} new added to the employee master` : ""}.` }); setPv(null); setFile(null); router.refresh(); }
              })}><Icon name="check" size="sm" />{confirm ? "Save anyway" : "Save"} for {unit} · {month}</button></span></div>
          <div className="card-b row wrap" style={{ gap: 28 }}>
            {[["Total earning", inr(pv.totals.totalEarning)], ["PF employee", inr(pv.totals.pf)], ["ESIC employee", inr(pv.totals.esi)], ["Net salary", inr(pv.totals.net)], ["New to the master", String(pv.people.filter((p) => p.isNew).length)]].map(([l, v]) => (
              <div key={l}><div className="dim" style={{ fontSize: 12 }}>{l}</div><div style={{ font: "600 17px var(--display)" }}>{v}</div></div>))}
          </div>
          {pv.warnings.length ? <div className="card-b" style={{ paddingTop: 0 }}>{pv.warnings.map((w) => <div key={w} className="alert warn" style={{ marginTop: 8 }}><Icon name="alert" size="sm" /><div>{w}</div></div>)}</div> : null}
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th>Code</th><th>Name</th><th className="num">Days</th><th className="num">LOP</th><th className="num">Total earning</th><th className="num">PF</th><th className="num">ESIC</th><th className="num">Net</th><th></th></tr></thead>
            <tbody>{pv.people.map((p) => (
              <tr key={p.card + p.name}><td className="mono">{p.card}</td><td>{p.name}<div className="dim" style={{ fontSize: 11 }}>{p.designation ?? ""}</div></td>
                <td className="num">{p.days}</td><td className="num">{p.lop}</td><td className="num">{inr(p.totalEarning)}</td><td className="num">{inr(p.pfEE)}</td><td className="num">{inr(p.esiEE)}</td><td className="num"><b>{inr(p.net)}</b></td>
                <td>{p.isNew ? <span className="badge b-blue">New — will be added</span> : null}{p.codes ? null : <span className="badge b-amber">No day codes</span>}</td></tr>))}</tbody>
          </table></div>
        </div>
      ) : null}
      {!pv ? <p className="dim" style={{ fontSize: 12.5 }}>After saving, the month shows on <Link href={`/portal/payroll/working-salary?unit=${unit}&month=${month}`}>Working Salary</Link> and goes through Approval &amp; Lock, payslips, the worker page and PF / ESIC like the other units.</p> : null}
    </>
  );
}
