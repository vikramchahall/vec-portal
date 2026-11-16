"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDocument, uploadDocument } from "./actions";
import { Icon } from "@/components/vec/Icon";

export function UploadDocument({ employeeId, kinds }: { employeeId: number; kinds: [string, string][] }) {
  const router = useRouter();
  const [kind, setKind] = useState("aadhaar");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="toolbar" style={{ flexWrap: "wrap" }}>
      <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 200 }} />
      <label className="btn primary" style={{ cursor: "pointer" }}><Icon name="upload" size="sm" />{pending ? "Uploading…" : "Upload file"}
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={pending} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const fd = new FormData(); fd.set("employeeId", String(employeeId)); fd.set("kind", kind); fd.set("note", note); fd.set("file", f);
          start(async () => { const r = await uploadDocument(fd); setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: `${f.name} saved.` }); if (!r.error) { setNote(""); router.refresh(); } });
        }} /></label>
      <span className="dim" style={{ fontSize: 12 }}>PDF or photo, up to 5 MB · stored encrypted</span>
      {msg ? <span style={{ fontSize: 12.5, color: msg.ok ? "var(--ok)" : "var(--err)" }}>{msg.t}</span> : null}
    </div>
  );
}

export function DeleteDocument({ employeeId, id, name }: { employeeId: number; id: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="btn sm ghost" disabled={pending} title="Delete" onClick={() => { if (confirm(`Delete ${name}? This cannot be undone.`)) start(async () => { await deleteDocument(employeeId, id); router.refresh(); }); }}><Icon name="x" size="sm" /></button>;
}
