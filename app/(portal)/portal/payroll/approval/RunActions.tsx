"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveAction, lockAction, reopenAction } from "./actions";
import { Icon } from "@/components/vec/Icon";

type Dialog = "approve" | "reopen" | "lock" | null;

export default function RunActions({ unit, year, month, status, ready, owner, phrase, summary }: {
  unit: string; year: number; month: number; status: string; ready: boolean; owner: boolean; phrase: string; summary: string;
}) {
  const router = useRouter();
  const [dlg, setDlg] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = (d: Dialog) => { setDlg(d); setText(""); setSure(false); setErr(null); };
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); if (r.error) setErr(r.error); else { setDlg(null); router.refresh(); } });

  return (
    <>
      <div className="row wrap">
        {status === "draft" ? (
          <button className="btn primary" style={{ background: "var(--ok)", borderColor: "var(--ok)" }} disabled={!owner || !ready} onClick={() => open("approve")}>
            <Icon name="checkCircle" size="sm" />Approve {unit}…</button>
        ) : null}
        {status === "approved" ? <>
          <button className="btn lock" disabled={!owner} onClick={() => open("lock")}><Icon name="lock" size="sm" />Lock {unit}…</button>
          <button className="btn ghost" disabled={!owner} onClick={() => open("reopen")}>Reopen for changes</button>
        </> : null}
      </div>

      {dlg ? (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDlg(null); }}>
          <div className="modal">
            <div className="mh">
              <div className="ico" style={dlg === "lock" ? { background: "var(--navy)", color: "#fff" } : { background: "var(--ok-50)", color: "var(--ok)" }}><Icon name={dlg === "lock" ? "lock" : dlg === "approve" ? "shield" : "unlock"} size="lg" /></div>
              <div>
                <h2>{dlg === "approve" ? `Approve ${unit}?` : dlg === "lock" ? `Lock ${unit}` : `Reopen ${unit}?`}</h2>
                <div className="muted mt8">{summary}.{" "}
                  {dlg === "approve" ? "Codes and entries can no longer be changed; you can reopen it until it is locked."
                    : dlg === "lock" ? <>Final and permanent. Type <b className="mono">{phrase}</b> to confirm.</>
                    : "The month goes back to draft so codes and entries can be changed."}</div>
              </div>
            </div>
            <div className="mb">
              {dlg === "lock" ? <>
                <input className="input" style={{ width: "100%" }} value={text} onChange={(e) => setText(e.target.value)} placeholder={phrase} />
                <label className="row mt16" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />I have checked the totals, the exceptions and the payslips for this unit</label>
                <div className="alert err mt16"><Icon name="alert" size="sm" /><div>Locking cannot be undone. Corrections after this are paid as arrears in a later month.</div></div>
              </> : (
                <div className="field"><label>{dlg === "reopen" ? <>Reason <span className="req">*</span></> : "Note (optional)"}</label>
                  <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={dlg === "reopen" ? "e.g. one more leave application" : "e.g. checked against site register"} /></div>
              )}
              {err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}
            </div>
            <div className="mf">
              <button className="btn" onClick={() => setDlg(null)}>Cancel</button>
              {dlg === "approve" ? <button className="btn primary" style={{ background: "var(--ok)", borderColor: "var(--ok)" }} disabled={pending} onClick={() => run(() => approveAction(unit, year, month, text))}><Icon name="check" size="sm" />Approve</button> : null}
              {dlg === "reopen" ? <button className="btn" disabled={pending} onClick={() => run(() => reopenAction(unit, year, month, text))}>Reopen</button> : null}
              {dlg === "lock" ? <button className="btn lock" disabled={pending || !sure || text.trim().toUpperCase() !== phrase} onClick={() => run(() => lockAction(unit, year, month, text))}><Icon name="lock" size="sm" />Lock payroll</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
