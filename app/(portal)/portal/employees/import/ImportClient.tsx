"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { applyImport, previewImport, type ApplyResult, type PreviewRow, type PreviewState } from "./actions";
import { Icon } from "@/components/vec/Icon";

type Unit = { code: string; siteName: string };
const ACTION: Record<PreviewRow["action"], [string, string]> = { new: ["b-blue", "New"], update: ["b-amber", "Update"], same: ["b-grey", "No change"] };

export default function ImportClient({ units }: { units: Unit[] }) {
  const [state, preview, reading] = useActionState<PreviewState, FormData>(previewImport, null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [applying, start] = useTransition();
  const files = state && "files" in state ? state.files : [];
  const rows = files.flatMap((f) => f.rows);
  const ok = rows.filter((r) => !r.problems.length);
  const n = { new: ok.filter((r) => r.action === "new").length, update: ok.filter((r) => r.action === "update").length, same: ok.filter((r) => r.action === "same").length };

  if (result) {
    return "error" in result ? <div className="alert err"><Icon name="xCircle" size="sm" /><div>{result.error}</div></div> : (
      <div className="card"><div className="card-b">
        <div className="alert ok"><Icon name="checkCircle" size="sm" /><div><b>Import finished.</b> {result.created} added · {result.updated} updated · {result.unchanged} unchanged{result.failed.length ? ` · ${result.failed.length} not imported` : ""}.</div></div>
        {result.failed.length ? <ul className="mt16">{result.failed.map((f) => <li key={f.cardNo}><span className="mono">{f.cardNo}</span> {f.name}: {f.error}</li>)}</ul> : null}
        <div className="row mt16"><Link className="btn primary" href="/portal/employees">Open the directory</Link><button className="btn" onClick={() => location.reload()}>Import more files</button></div>
      </div></div>
    );
  }

  return (
    <>
      <form action={preview} className="card">
        <div className="card-h"><h3>1. Choose files</h3><span className="right dim" style={{ fontSize: 12 }}>Nothing is saved until you confirm in step 2</span></div>
        <div className="card-b form-grid">
          <div className="field"><label htmlFor="unit">Unit these files belong to</label>
            <select className="select" id="unit" name="unit" required defaultValue="">
              <option value="" disabled>Choose unit…</option>
              {units.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.siteName}</option>)}
            </select>
            <span className="hint">A &ldquo;Unit&rdquo; column in the VEC template overrides this</span></div>
          <div className="field"><label htmlFor="monthStart">Structures apply from</label>
            <input className="input" id="monthStart" name="monthStart" type="date" defaultValue="2026-10-01" />
            <span className="hint">First day of the month the files are for</span></div>
          <div className="field"><label htmlFor="files">Excel files</label>
            <input className="input" id="files" name="files" type="file" accept=".xlsx,.xlsm" multiple required style={{ paddingTop: 5 }} />
            <span className="hint">Working_Salary_&lt;UNIT&gt;_Oct-2026.xlsx (staff or driver) or the <a href="/portal/employees/template">VEC template</a></span></div>
        </div>
        <div className="card-h" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
          <span className="dim" style={{ fontSize: 12.5 }}>Read from the files: card, name, register no., designation, category, joining date, weekly off, full-month structure, PF / ESIC / bonus, bank, account, IFSC, UAN.</span>
          <div className="right"><button className="btn primary" disabled={reading} type="submit"><Icon name={reading ? "loader" : "fileText"} size="sm" className={reading ? "spin" : ""} />{reading ? "Reading…" : "Read files"}</button></div>
        </div>
      </form>

      {state && "error" in state ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{state.error}</div></div> : null}

      {files.length ? (
        <div className="card mt16">
          <div className="card-h"><h3>2. Check and confirm</h3>
            <div className="right row wrap"><span className="badge b-blue">{n.new} new</span><span className="badge b-amber">{n.update} to update</span><span className="badge b-grey">{n.same} unchanged</span>
              {rows.length - ok.length ? <span className="badge b-red">{rows.length - ok.length} with problems</span> : null}</div></div>
          {files.map((f) => (
            <div key={f.file} className="card-b" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="row"><Icon name="file" size="sm" /><b>{f.file}</b><span className="dim">{f.kind === "template" ? "VEC template" : f.kind === "salary-workbook" ? "salary workbook" : ""} · {f.rows.length} people</span></div>
              {f.error ? <div className="alert err mt8"><Icon name="xCircle" size="sm" /><div>{f.error}</div></div> : null}
              {f.warnings.map((w) => <div key={w} className="alert warn mt8"><Icon name="alert" size="sm" /><div>{w}</div></div>)}
            </div>
          ))}
          <div className="tbl-wrap" style={{ maxHeight: 520 }}><table className="tbl compact">
            <thead><tr><th>Action</th><th>Card</th><th>Name</th><th>Unit</th><th>Designation</th><th>Category</th><th className="num">Basic+DA</th><th className="num">HRA</th><th>PF / ESIC</th><th>Bank</th><th>UAN</th><th>What changes</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.cardNo + r.unitCode}>
                <td>{r.problems.length ? <span className="badge b-red">Problem</span> : <span className={`badge ${ACTION[r.action][0]}`}>{ACTION[r.action][1]}</span>}</td>
                <td className="mono">{r.cardNo}</td><td>{r.name}</td><td>{r.unitCode || "—"}</td><td>{r.designation ?? "—"}</td><td>{r.category ?? "—"}</td>
                <td className="num">{r.basicDa?.toLocaleString("en-IN") ?? "—"}</td><td className="num">{r.hra?.toLocaleString("en-IN") ?? "—"}</td>
                <td>{r.pfMember ? "PF" : "—"}{r.esiMember ? " · ESIC" : ""}</td>
                <td>{r.account && r.ifsc ? `••${r.account.slice(-4)}` : <span className="badge b-amber">Missing</span>}</td>
                <td className="mono">{r.uan ?? <span className="badge b-amber">Missing</span>}</td>
                <td style={{ whiteSpace: "normal", minWidth: 240, fontSize: 12 }}>{r.problems.length ? <span style={{ color: "var(--err)" }}>{r.problems.join("; ")}</span> : r.changes.join(" · ") || (r.action === "new" ? "Added with a new VEC ID" : "")}</td>
              </tr>))}</tbody>
          </table></div>
          <div className="card-h" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <span className="dim" style={{ fontSize: 12.5 }}>Existing people are matched by their current card. Empty cells in Excel never erase what the portal already has.</span>
            <div className="right"><button className="btn primary" disabled={applying || n.new + n.update === 0}
              onClick={() => start(async () => setResult(await applyImport(ok, (state && "monthStart" in state) ? state.monthStart : "2026-10-01")))}>
              <Icon name={applying ? "loader" : "check"} size="sm" className={applying ? "spin" : ""} />{applying ? "Importing…" : `Import ${n.new + n.update} employee${n.new + n.update === 1 ? "" : "s"}`}</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
