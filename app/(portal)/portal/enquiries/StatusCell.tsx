"use client";

import { useState, useTransition } from "react";
import { setFormStatus } from "./actions";

const LABEL: Record<string, string> = { new: "New", replied: "Replied", closed: "Closed", called: "Called", shortlisted: "Shortlisted", not_suitable: "Not suitable" };

export default function StatusCell({ kind, id, status, note, options }: { kind: "enquiry" | "application"; id: number; status: string; note: string | null; options: string[] }) {
  const [s, setS] = useState(status), [n, setN] = useState(note ?? "");
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();
  const save = (st: string, nt: string) => start(async () => { const r = await setFormStatus(kind, id, st, nt); setSaved(!r.error); });
  return (
    <div style={{ display: "grid", gap: 4, minWidth: 170 }}>
      <select className="select" value={s} disabled={pending} onChange={(e) => { setS(e.target.value); save(e.target.value, n); }}>
        {options.map((o) => <option key={o} value={o}>{LABEL[o] ?? o}</option>)}
      </select>
      <input className="input" placeholder="Note (e.g. called on 18-Nov)" value={n} onChange={(e) => { setN(e.target.value); setSaved(false); }} onBlur={() => { if (!saved) save(s, n); }} style={{ fontSize: 12 }} />
    </div>
  );
}
