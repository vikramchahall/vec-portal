"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDayCode, setHolidays } from "./actions";
import { Icon } from "@/components/vec/Icon";

export type GridPerson = {
  employeeId: number; card: string; name: string; designation: string | null; final: string[]; raw: string[];
  overrides: Record<number, { code: string; reason: string; actor: string }>;
  counts: { P: number; H: number; HP: number; WO: number; L: number; CL: number; X: number; payable: number };
  bf: { cl: number; l: number }; credit: { cl: number; l: number }; used: { cl: number; l: number }; close: { cl: number; l: number };
  coff: { excess: number; less: number }; inDay: Record<number, string>;
};
const CODES: [string, string][] = [["P", "Present"], ["HP", "Holiday worked"], ["H", "Holiday"], ["WO", "Weekly off"], ["X", "Absent (unpaid)"], ["L", "Leave"], ["CL", "Casual leave / C-Off"], ["OD", "On duty elsewhere"], ["NOPUNCH", "Ignore that day's punches (card issue)"]];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const n3 = (x: number) => (Math.round(x * 1000) / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export default function ReviewGrid({ unit, year, month, days, holidays, locked, people, siteName }: {
  unit: string; year: number; month: number; days: number; holidays: number[]; locked: boolean; people: GridPerson[]; siteName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ p: GridPerson; day: number } | null>(null);
  const [code, setCode] = useState("L");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [hol, setHol] = useState(holidays.join(", "));
  const dow = (d: number) => new Date(Date.UTC(year, month - 1, d)).getUTCDay();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (r.error) setErr(r.error); else { setErr(null); after?.(); router.refresh(); } });

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-b row wrap" style={{ gap: 12 }}>
          <Icon name="sun" size="sm" /><b>Holidays in this month</b>
          <input className="input" style={{ width: 160 }} value={hol} onChange={(e) => setHol(e.target.value)} placeholder="e.g. 2, 20" disabled={locked} />
          <button className="btn sm" disabled={pending || locked} onClick={() => run(() => setHolidays(unit, year, month, hol, false))}>Save for {unit}</button>
          <button className="btn sm" disabled={pending || locked} onClick={() => run(() => setHolidays(unit, year, month, hol, true))}>Save for all {siteName} units</button>
          <span className="dim" style={{ fontSize: 12 }}>Holiday worked = HP (paid extra), not worked = H</span>
          {err ? <span className="badge b-red">{err}</span> : null}
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap" style={{ maxHeight: 680 }}>
          <table className="tbl compact" style={{ fontSize: 12 }}>
            <thead><tr>
              <th style={{ position: "sticky", left: 0, zIndex: 3, minWidth: 200 }}>Employee</th>
              {[...Array(days)].map((_, i) => <th key={i} style={{ textAlign: "center", padding: "6px 2px" }} className={dow(i + 1) === 0 ? "th-sun" : ""}>{i + 1}<div className="dim" style={{ fontWeight: 400 }}>{DOW[dow(i + 1)]}</div></th>)}
              {["P", "H", "HP", "WO", "L", "CL", "X", "Pay days"].map((h) => <th key={h} className="num">{h}</th>)}
              <th className="num" title="L: brought forward + earned − used = closing">L b/f · earned · used · close</th>
              <th className="num" title="CL: brought forward + credited from C-Off − used = closing">CL b/f · credit · used · close</th>
              <th className="num">C-Off + / −</th>
            </tr></thead>
            <tbody>{people.map((p) => (
              <tr key={p.employeeId}>
                <td style={{ position: "sticky", left: 0, background: "var(--card)", zIndex: 1 }}>
                  <Link href={`/portal/employees/${p.employeeId}`} style={{ color: "var(--text)" }}><b>{p.name}</b></Link>
                  <div className="dim" style={{ fontSize: 11 }}>{p.card}{p.designation ? ` · ${p.designation}` : ""}</div>
                </td>
                {p.final.map((c, i) => {
                  const o = p.overrides[i + 1];
                  return (
                    <td key={i} style={{ padding: "3px 1px", textAlign: "center" }}>
                      <button type="button" disabled={locked} title={`${i + 1}-${month}${p.inDay[i + 1] ? ` · IN ${p.inDay[i + 1]}` : ""}${o ? ` · changed by ${o.actor}: ${o.reason}` : ""}${p.raw[i] !== c ? ` · ${p.raw[i]} covered by ${c}` : ""}`}
                        className={`code ${c || ""} ${o ? "manual" : ""}`} style={{ border: 0, cursor: locked ? "default" : "pointer", minWidth: 26 }}
                        onClick={() => { setEdit({ p, day: i + 1 }); setCode(o?.code ?? (c === "X" ? "L" : "P")); setReason(o?.reason ?? ""); setErr(null); }}>
                        {o?.code === "NOPUNCH" ? "·" : c || "-"}
                      </button>
                    </td>
                  );
                })}
                <td className="num">{p.counts.P}</td><td className="num">{p.counts.H}</td><td className="num">{p.counts.HP}</td><td className="num">{p.counts.WO}</td>
                <td className="num">{p.counts.L}</td><td className="num">{p.counts.CL}</td><td className="num" style={p.counts.X ? { color: "var(--err)", fontWeight: 600 } : undefined}>{p.counts.X}</td>
                <td className="num"><b>{p.counts.payable}</b></td>
                <td className="num mono">{n3(p.bf.l)} · {n3(p.credit.l)} · {p.used.l} · <b>{n3(p.close.l)}</b></td>
                <td className="num mono">{n3(p.bf.cl)} · {n3(p.credit.cl)} · {p.used.cl} · <b>{n3(p.close.cl)}</b></td>
                <td className="num mono">{p.coff.excess ? `+${p.coff.excess}` : "0"} / {p.coff.less || 0}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
        <div className="card-b row wrap" style={{ borderTop: "1px solid var(--line)", fontSize: 12, gap: 10 }}>
          {["P", "HP", "H", "WO", "L", "CL", "X"].map((c) => <span key={c} className={`code ${c}`}>{c}</span>)}
          <span className="code CL manual">CL</span><span className="dim">blue outline = changed by hand · hover a day for IN time, reason or cover · click a day to change it</span>
        </div>
      </div>

      {edit ? (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <div className="modal">
            <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="edit" size="lg" /></div>
              <div><h2>{edit.p.name} · {edit.day}-{month}-{year}</h2>
                <div className="muted mt8">Now: <b>{edit.p.final[edit.day - 1] || "-"}</b>{edit.p.raw[edit.day - 1] !== edit.p.final[edit.day - 1] ? ` (X covered by ${edit.p.final[edit.day - 1]})` : ""}{edit.p.inDay[edit.day] ? ` · IN ${edit.p.inDay[edit.day]}` : " · no punch"}</div></div></div>
            <div className="mb">
              <div className="field"><label>New code</label>
                <select className="select" value={code} onChange={(e) => setCode(e.target.value)}>{CODES.map(([c, t]) => <option key={c} value={c}>{c} — {t}</option>)}</select></div>
              <div className="field mt16"><label>Reason <span className="req">*</span></label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. leave application, card not working, supervisor confirmed" /></div>
              <div className="hint mt8">X typed here is still covered by L / CL if balance is left; type L or CL to use leave on purpose.</div>
              {err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}
            </div>
            <div className="mf">
              {edit.p.overrides[edit.day] ? <button className="btn ghost" disabled={pending} onClick={() => run(() => setDayCode(unit, year, month, edit.p.employeeId, [edit.day], null, ""), () => setEdit(null))}>Back to automatic</button> : null}
              <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn" disabled={pending} title="Every X day of this person this month"
                onClick={() => run(() => setDayCode(unit, year, month, edit.p.employeeId, edit.p.final.map((c, i) => (c === "X" ? i + 1 : 0)).filter(Boolean), code, reason), () => setEdit(null))}>Apply to all X days</button>
              <button className="btn primary" disabled={pending} onClick={() => run(() => setDayCode(unit, year, month, edit.p.employeeId, [edit.day], code, reason), () => setEdit(null))}><Icon name="check" size="sm" />Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
