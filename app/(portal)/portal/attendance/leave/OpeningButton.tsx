"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOpeningAction } from "./actions";
import { Icon } from "@/components/vec/Icon";

export default function OpeningButton({ unit, year, month, employeeId, name, cl, l, disabled }: { unit: string; year: number; month: number; employeeId: number; name: string; cl: number; l: number; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ cl: String(cl), l: String(l), reason: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn sm ghost" disabled={disabled} title={disabled ? "Month is approved / locked" : "Correct the opening balance"} onClick={() => { setV({ cl: String(cl), l: String(l), reason: "" }); setErr(null); setOpen(true); }}><Icon name="edit" size="sm" /></button>
      {open ? (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal">
            <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="sun" size="lg" /></div><div><h2>Opening balance · {name}</h2><div className="muted mt8">Brought forward into this month. The cover of X days and the closing balance are worked out again from it.</div></div></div>
            <div className="mb"><div className="grid g2" style={{ gap: 12 }}>
              <div className="field"><label>Leave (L) B/F</label><input className="input" inputMode="decimal" value={v.l} onChange={(e) => setV({ ...v, l: e.target.value })} /></div>
              <div className="field"><label>CL / C-Off B/F</label><input className="input" inputMode="decimal" value={v.cl} onChange={(e) => setV({ ...v, cl: e.target.value })} /></div>
              <div className="field span2"><label>Reason <span className="req">*</span></label><input className="input" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="e.g. balance from the Sep-26 sheet" /></div>
            </div>{err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}</div>
            <div className="mf"><button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await setOpeningAction(unit, year, month, employeeId, Number(v.cl), Number(v.l), v.reason); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}><Icon name="check" size="sm" />Save</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
