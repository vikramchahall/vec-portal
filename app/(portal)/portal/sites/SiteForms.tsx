"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSite, saveTemplate, saveUnit, type SiteInput, type UnitInput } from "./actions";
import { Icon } from "@/components/vec/Icon";

type Site = SiteInput & { id: number };
type Unit = Omit<UnitInput, "workOrders"> & { id: number; workOrders: string[] };

function Modal({ title, onClose, children, onSave, pending, err }: { title: string; onClose: () => void; children: React.ReactNode; onSave: () => void; pending: boolean; err: string | null }) {
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mh"><div className="ico" style={{ background: "var(--brand-50)", color: "var(--brand)" }}><Icon name="factory" size="lg" /></div><div><h2>{title}</h2></div></div>
        <div className="mb">{children}{err ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{err}</div></div> : null}</div>
        <div className="mf"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={pending} onClick={onSave}><Icon name="check" size="sm" />Save</button></div>
      </div>
    </div>
  );
}

export function SiteButton({ site }: { site?: Site }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: SiteInput = site ?? { code: "", name: "", client: "", state: "Punjab", billingModel: "per_employee" };
  const [v, setV] = useState<SiteInput>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className={site ? "btn sm ghost" : "btn primary"} onClick={() => { setV(initial); setOpen(true); setErr(null); }}><Icon name={site ? "edit" : "plus"} size="sm" />{site ? "Edit" : "Add site"}</button>
      {open ? (
        <Modal title={site ? `Edit ${site.name}` : "Add site"} onClose={() => setOpen(false)} pending={pending} err={err}
          onSave={() => start(async () => { const r = await saveSite(site?.id ?? null, v); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
          <div className="grid g2" style={{ gap: 12 }}>
            <div className="field"><label>Site code <span className="req">*</span></label><input className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="e.g. NFL-BTI" /></div>
            <div className="field"><label>State <span className="req">*</span></label><input className="input" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} placeholder="Punjab" /><span className="hint">Decides minimum wages, PT and LWF</span></div>
            <div className="field span2"><label>Site name <span className="req">*</span></label><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. NFL Bathinda" /></div>
            <div className="field span2"><label>Client</label><input className="input" value={v.client} onChange={(e) => setV({ ...v, client: e.target.value })} placeholder="Company that hired VEC" /></div>
            <div className="field span2"><label>How the client pays</label>
              <select className="select" value={v.billingModel} onChange={(e) => setV({ ...v, billingModel: e.target.value })}>
                <option value="per_employee">Rate per employee</option><option value="percent_of_bill">Percentage on the monthly bill</option>
              </select></div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function UnitButton({ siteId, unit }: { siteId: number; unit?: Unit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: UnitInput = unit ? { ...unit, workOrders: unit.workOrders.join(", ") } : { siteId, code: "", name: "", workOrders: "", mode: "punch" };
  const [v, setV] = useState<UnitInput>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className={unit ? "btn sm ghost" : "btn sm"} onClick={() => { setV(initial); setOpen(true); setErr(null); }}><Icon name={unit ? "edit" : "plus"} size="sm" />{unit ? "" : "Add unit"}</button>
      {open ? (
        <Modal title={unit ? `Edit unit ${unit.code}` : "Add unit"} onClose={() => setOpen(false)} pending={pending} err={err}
          onSave={() => start(async () => { const r = await saveUnit(unit?.id ?? null, { ...v, siteId }); if (r.error) setErr(r.error); else { setOpen(false); router.refresh(); } })}>
          <div className="grid g2" style={{ gap: 12 }}>
            <div className="field"><label>Unit code <span className="req">*</span></label><input className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="e.g. ETP-PET" /></div>
            <div className="field"><label>Attendance from</label>
              <select className="select" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })}><option value="punch">Gate punch file</option><option value="file">Site working-salary file</option></select></div>
            <div className="field span2"><label>Unit name <span className="req">*</span></label><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Effluent Treatment Plant — Petchem" /></div>
            <div className="field span2"><label>Work order number(s)</label><input className="input mono" value={v.workOrders} onChange={(e) => setV({ ...v, workOrders: e.target.value })} placeholder="e.g. 300005425PET" />
              <span className="hint">Exactly as in the WorkOrderNo column of the gate file; several separated by commas</span></div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function TemplateButton({ unitId, has }: { unitId: number; has: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <label className="btn sm" style={{ cursor: "pointer" }}><Icon name="upload" size="sm" />{pending ? "Uploading…" : has ? "Replace" : "Upload"}
        <input type="file" accept=".xlsx" hidden disabled={pending} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const fd = new FormData(); fd.set("unitId", String(unitId)); fd.set("file", f);
          start(async () => { const r = await saveTemplate(fd); setErr(r.error ?? null); if (!r.error) router.refresh(); });
        }} /></label>
      {err ? <div className="dim" style={{ color: "var(--err)", fontSize: 12, marginTop: 4 }}>{err}</div> : null}
    </>
  );
}
