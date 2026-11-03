"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAdjustment } from "./actions";
import { Icon } from "@/components/vec/Icon";

type Adj = { otDays: number; hold: number; leaveEncashment: number; reason: string } | null;

export default function AdjustButton({ unit, year, month, employeeId, name, adj, locked }: { unit: string; year: number; month: number; employeeId: number; name: string; adj: Adj; locked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ otDays: String(adj?.otDays ?? 0), hold: String(adj?.hold ?? 0), leaveEncashment: String(adj?.leaveEncashment ?? 0), reason: adj?.reason ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tags = adj ? [adj.otDays ? `OT ${adj.otDays}` : "", adj.hold ? "Hold" : "", adj.leaveEncashment ? "LE" : ""].filter(Boolean).join(" · ") : "";
  return (
    <>
      <button type="button" className={`btn sm ${tags ? "" : "ghost"}`} disabled={locked} title="OT days, hold, leave encashment" onClick={() => setOpen(true)}>
        <Icon name="edit" size="sm" />{tags}
      </button>
      {open ? (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal">
            <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="wallet" size="lg" /></div>
              <div><h2>{name}</h2><div className="muted mt8">Entries for this month only.</div></div></div>
            <div className="mb">
              <div className="grid g3" style={{ gap: 12 }}>
                <div className="field"><label>OT days</label><input className="input" inputMode="decimal" value={v.otDays} onChange={(e) => setV({ ...v, otDays: e.target.value })} /><span className="hint">paid gross ÷ 26 × 2 per day</span></div>
                <div className="field"><label>Hold (₹)</label><input className="input" inputMode="numeric" value={v.hold} onChange={(e) => setV({ ...v, hold: e.target.value })} /></div>
                <div className="field"><label>Leave encashment (₹)</label><input className="input" inputMode="numeric" value={v.leaveEncashment} onChange={(e) => setV({ ...v, leaveEncashment: e.target.value })} /></div>
              </div>
              <div className="field mt16"><label>Reason <span className="req">*</span></label><input className="input" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="e.g. OT approved by plant in-charge" /></div>
              {err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}
            </div>
            <div className="mf"><button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={pending} onClick={() => start(async () => {
                const r = await setAdjustment(unit, year, month, employeeId, { otDays: Number(v.otDays) || 0, hold: Number(v.hold) || 0, leaveEncashment: Number(v.leaveEncashment) || 0, reason: v.reason });
                if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); }
              })}><Icon name="check" size="sm" />Save</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
