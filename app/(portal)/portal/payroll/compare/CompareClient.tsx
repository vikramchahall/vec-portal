"use client";

import { Fragment, useState, useTransition } from "react";
import { compareAction } from "./actions";
import type { CompareResult, PersonCompare } from "@/lib/compare";
import { Icon } from "@/components/vec/Icon";

const n = (x: number) => (Number.isInteger(x) ? x.toLocaleString("en-IN") : x.toFixed(2));
const monthLabel = (mo: string) => new Date(mo + "-01T00:00:00Z").toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const STATUS: Record<PersonCompare["status"], [string, string]> = {
  differs: ["Differs", "b-amber"], "only-file": ["Only in Excel", "b-red"], "only-portal": ["Only in portal", "b-red"], "no-structure": ["No structure", "b-red"], same: ["Same", "b-green"],
};

export default function CompareClient({ units, months, unit: u0, month: m0 }: { units: string[]; months: string[]; unit: string; month: string }) {
  const [unit, setUnit] = useState(u0), [month, setMonth] = useState(m0);
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<CompareResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showSame, setShowSame] = useState(false);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    if (!file) return;
    const fd = new FormData(); fd.set("unit", unit); fd.set("month", month); fd.set("file", file);
    const r = await compareAction(fd);
    setErr(r.error ?? null); setRes(r.result ?? null);
  });
  const differ = res?.people.filter((p) => p.status !== "same") ?? [];
  const same = (res?.people.length ?? 0) - differ.length;
  const checked = res?.people.filter((p) => p.sameWithFileInputs !== null) ?? [];
  const agree = checked.filter((p) => p.sameWithFileInputs).length;
  const list = showSame ? res?.people ?? [] : differ;

  return (
    <>
      <div className="card toolbar" style={{ marginBottom: 16 }}>
        <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>{units.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}</select>
        <label className="btn" style={{ cursor: "pointer" }}><Icon name="upload" size="sm" />{file ? file.name : "Choose Excel file…"}
          <input type="file" accept=".xlsx" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} /></label>
        <button className="btn primary" disabled={!file || pending} onClick={run}><Icon name="swap" size="sm" />{pending ? "Comparing…" : "Compare"}</button>
      </div>
      {err ? <div className="alert err" style={{ marginBottom: 12 }}><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}
      {res ? <>
        {res.warnings.map((w) => <div key={w} className="alert warn" style={{ marginBottom: 8 }}><Icon name="alert" size="sm" /><div>{w}</div></div>)}
        <div className="card" style={{ marginBottom: 16 }}><div className="card-b row wrap" style={{ gap: 28 }}>
          {[["People", String(res.people.length)], ["Same to the rupee", String(same)], ["Differ", String(differ.length)], ["Formulas agree on the file's inputs", `${agree} of ${checked.length}`]].map(([l, v]) => (
            <div key={l}><div className="dim" style={{ fontSize: 12 }}>{l}</div><div style={{ font: "600 18px var(--display)" }}>{v}</div></div>))}
        </div></div>
        {checked.length && agree === checked.length ? <div className="alert ok" style={{ marginBottom: 12 }}><Icon name="checkCircle" size="sm" /><div>With the same days, structure and entries, the portal&apos;s formulas give exactly the Excel rupees for everyone. Every difference below comes from an <b>input</b>: fix it in the portal (day codes, leave B/F, pay structure, or Adjust on Working Salary).</div></div> : null}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><h3>Totals</h3><span className="right dim">sheet “{res.sheet}”</span></div>
          <div className="tbl-wrap"><table className="tbl compact"><thead><tr><th>Column</th><th className="num">Excel</th><th className="num">Portal</th><th className="num">Difference</th></tr></thead>
            <tbody>{res.totals.map((t) => <tr key={t.col}><td><span className="mono dim">{t.col}</span> {t.label}</td><td className="num">{n(t.file)}</td><td className="num">{n(t.portal)}</td>
              <td className="num" style={{ color: Math.abs(t.portal - t.file) > 0.01 ? "var(--err)" : undefined }}>{n(t.portal - t.file)}</td></tr>)}</tbody></table></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>{showSame ? "Everyone" : "People who differ"}</h3>
            <label className="right row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />Show the ones that match too</label></div>
          {list.length ? <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th>Card</th><th>Name</th><th>Status</th><th>Why (click a row for every column)</th><th className="num">CTC Excel</th><th className="num">CTC portal</th></tr></thead>
            <tbody>{list.map((p) => {
              const ctc = p.cols.find((c) => c.col === "AK");
              const [label, tone] = STATUS[p.status];
              return (
                <Fragment key={p.card}>
                  <tr style={{ cursor: p.cols.length ? "pointer" : undefined }} onClick={() => setOpen(open === p.card ? null : p.card)}>
                    <td className="mono">{p.card}</td><td>{p.name}</td><td><span className={`badge ${tone}`}>{label}</span></td>
                    <td style={{ fontSize: 12.5, whiteSpace: "normal" }}>{p.reasons.length ? p.reasons.map((r) => <div key={r}>{r}</div>) : <span className="dim">—</span>}</td>
                    <td className="num">{ctc ? n(ctc.file) : ""}</td><td className="num">{ctc ? n(ctc.portal) : ""}</td></tr>
                  {open === p.card && p.cols.length ? <tr><td colSpan={6}>
                    <table className="tbl compact"><thead><tr><th>Column</th><th className="num">Excel</th><th className="num">Portal</th></tr></thead>
                      <tbody>{p.cols.map((c) => <tr key={c.col}><td><span className="mono dim">{c.col}</span> {c.label}</td><td className="num">{n(c.file)}</td><td className="num">{n(c.portal)}</td></tr>)}</tbody></table>
                  </td></tr> : null}
                </Fragment>
              );
            })}</tbody></table></div> : <div className="empty">Everyone matches to the rupee.</div>}
        </div>
      </> : null}
    </>
  );
}
