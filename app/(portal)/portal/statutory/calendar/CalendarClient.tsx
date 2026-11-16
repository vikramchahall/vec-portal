"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markDone, saveItem, undoDone, type ItemInput } from "./actions";
import { Icon } from "@/components/vec/Icon";

function Modal({ title, onClose, onSave, pending, err, children }: { title: string; onClose: () => void; onSave: () => void; pending: boolean; err: string | null; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="calendar" size="lg" /></div><div><h2>{title}</h2></div></div>
        <div className="mb">{children}{err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}</div>
        <div className="mf"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={pending} onClick={onSave}><Icon name="check" size="sm" />Save</button></div>
      </div>
    </div>
  );
}

export function DoneButton({ itemId, dueDate, title, done, owner }: { itemId: number; dueDate: string; title: string; done: { reference: string | null; by: string; at: string } | null; owner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ reference: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return (
    <span className="row" style={{ gap: 6 }}><span className="badge b-green"><Icon name="check" size="sm" />Done</span>
      <span className="dim" style={{ fontSize: 11.5 }}>{done.reference ? `${done.reference} · ` : ""}{done.at}</span>
      {owner ? <button className="btn sm ghost" disabled={pending} title="Undo" onClick={() => start(async () => { await undoDone(itemId, dueDate); router.refresh(); })}><Icon name="x" size="sm" /></button> : null}</span>
  );
  return (
    <>
      <button className="btn sm" onClick={() => { setOpen(true); setErr(null); }}><Icon name="check" size="sm" />Mark done</button>
      {open ? <Modal title={`Done · ${title}`} onClose={() => setOpen(false)} pending={pending} err={err}
        onSave={() => start(async () => { const r = await markDone(itemId, dueDate, v.reference, v.note); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
        <div className="field"><label>Challan / TRRN / acknowledgement no.</label><input className="input" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></div>
        <div className="field mt16"><label>Note</label><input className="input" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. paid ₹2,40,000 on 14-Nov" /></div>
      </Modal> : null}
    </>
  );
}

export function ItemButton({ item }: { item?: ItemInput & { id: number } }) {
  const router = useRouter();
  const init: ItemInput = item ?? { title: "", authority: "", frequency: "monthly", dueDay: 15, dueMonths: "", period: "previous month", appliesTo: "", notes: "", active: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ItemInput>(init);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className={item ? "btn sm ghost" : "btn"} onClick={() => { setV(init); setErr(null); setOpen(true); }}><Icon name={item ? "edit" : "plus"} size="sm" />{item ? "" : "Add obligation"}</button>
      {open ? <Modal title={item ? `Edit · ${item.title}` : "Add obligation"} onClose={() => setOpen(false)} pending={pending} err={err}
        onSave={() => start(async () => { const r = await saveItem(item?.id ?? null, v); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
        <div className="grid g2" style={{ gap: 12 }}>
          <div className="field span2"><label>What is due <span className="req">*</span></label><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
          <div className="field"><label>Authority</label><input className="input" value={v.authority} onChange={(e) => setV({ ...v, authority: e.target.value })} placeholder="EPFO, ESIC, …" /></div>
          <div className="field"><label>Applies to</label><input className="input" value={v.appliesTo} onChange={(e) => setV({ ...v, appliesTo: e.target.value })} placeholder="All units" /></div>
          <div className="field"><label>How often</label><select className="select" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value })}>
            <option value="monthly">Every month</option><option value="half_yearly">Twice a year</option><option value="yearly">Once a year</option></select></div>
          <div className="field"><label>Due on day</label><input className="input" type="number" min={1} max={31} value={v.dueDay} onChange={(e) => setV({ ...v, dueDay: Number(e.target.value) })} /></div>
          {v.frequency !== "monthly" ? <div className="field span2"><label>In month(s) (1 = Jan … 12 = Dec)</label><input className="input" value={v.dueMonths} onChange={(e) => setV({ ...v, dueMonths: e.target.value })} placeholder="e.g. 4, 10" /></div> : null}
          <div className="field span2"><label>Covers</label><input className="input" value={v.period} onChange={(e) => setV({ ...v, period: e.target.value })} placeholder="previous month" /></div>
          <div className="field span2"><label>Notes</label><input className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
          <label className="row span2" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active (shown in the calendar)</label>
        </div>
      </Modal> : null}
    </>
  );
}
