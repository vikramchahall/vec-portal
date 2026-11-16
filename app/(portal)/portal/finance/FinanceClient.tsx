"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBill, setRate, type BillInput } from "./actions";
import { Icon } from "@/components/vec/Icon";

function Modal({ title, sub, onClose, onSave, pending, err, children }: { title: string; sub?: string; onClose: () => void; onSave: () => void; pending: boolean; err: string | null; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="rupee" size="lg" /></div><div><h2>{title}</h2>{sub ? <div className="muted mt8">{sub}</div> : null}</div></div>
        <div className="mb">{children}{err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}</div>
        <div className="mf"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={pending} onClick={onSave}><Icon name="check" size="sm" />Save</button></div>
      </div>
    </div>
  );
}

export function RateButton({ unit, model, rate }: { unit: string; model: string; rate: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ model, rate: String(rate) });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn sm ghost" title="Change VEC's rate for this unit" onClick={() => { setV({ model, rate: String(rate) }); setErr(null); setOpen(true); }}><Icon name="edit" size="sm" /></button>
      {open ? <Modal title={`VEC's rate · ${unit}`} sub="Used for the expected earning of every month (past months too)." onClose={() => setOpen(false)} pending={pending} err={err}
        onSave={() => start(async () => { const r = await setRate(unit, v.model, Number(v.rate)); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
        <div className="grid g2" style={{ gap: 12 }}>
          <div className="field"><label>How VEC earns</label><select className="select" value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })}>
            <option value="per_employee">₹ per employee per month</option><option value="percent">% of the salary cost</option></select></div>
          <div className="field"><label>{v.model === "percent" ? "Percent" : "₹ per employee"}</label><input className="input" inputMode="decimal" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></div>
        </div>
      </Modal> : null}
    </>
  );
}

export function BillButton({ unit, year, month, bill, expected }: { unit: string; year: number; month: number; expected: number; bill: (BillInput & { amountN: number }) | null }) {
  const router = useRouter();
  const init: BillInput = bill ?? { amount: "", billNo: "", billDate: "", passedOn: "", note: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<BillInput>(init);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className={bill ? "btn sm ghost" : "btn sm"} onClick={() => { setV(init); setErr(null); setOpen(true); }}><Icon name={bill ? "edit" : "plus"} size="sm" />{bill ? "" : "Bill passed"}</button>
      {open ? <Modal title={`Bill passed · ${unit} · ${month}/${year}`} sub={`Expected bill ₹${expected.toLocaleString("en-IN")}. Enter the amount the client passed, before GST. Leave it empty to remove.`} onClose={() => setOpen(false)} pending={pending} err={err}
        onSave={() => start(async () => { const r = await saveBill(unit, year, month, v); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
        <div className="grid g2" style={{ gap: 12 }}>
          <div className="field span2"><label>Amount passed (₹, before GST)</label><input className="input" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder={String(expected)} /></div>
          <div className="field"><label>Bill no.</label><input className="input" value={v.billNo} onChange={(e) => setV({ ...v, billNo: e.target.value })} /></div>
          <div className="field"><label>Bill date</label><input className="input" type="date" value={v.billDate} onChange={(e) => setV({ ...v, billDate: e.target.value })} /></div>
          <div className="field"><label>Passed on</label><input className="input" type="date" value={v.passedOn} onChange={(e) => setV({ ...v, passedOn: e.target.value })} /></div>
          <div className="field"><label>Note</label><input className="input" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. 2 people cut" /></div>
        </div>
      </Modal> : null}
    </>
  );
}
