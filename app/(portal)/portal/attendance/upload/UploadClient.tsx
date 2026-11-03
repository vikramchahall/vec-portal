"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PunchParse } from "@/lib/punches";
import { addPunchBatch, beginPunchUpload, finishPunchUpload } from "./actions";
import { Icon } from "@/components/vec/Icon";

type Unit = { code: string; workOrders: string[] };
type Item = { file: File; status: "reading" | "ready" | "uploading" | "done" | "error"; parse?: PunchParse; sha?: string; error?: string; sent?: number; stored?: number };
const BATCH = 5000;

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function UploadClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const woUnit = new Map(units.flatMap((u) => u.workOrders.map((w) => [w, u.code] as const)));
  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function pick(fileList: FileList | null) {
    // copy now: the FileList empties when the input is reset right after this call
    const files = fileList ? [...fileList] : [];
    if (!files.length) return;
    const start = items.length;
    setItems((xs) => [...xs, ...files.map((file) => ({ file, status: "reading" as const }))]);
    const { parsePunchWorkbook } = await import("@/lib/punches"); // the Excel reader loads only on this page
    files.forEach(async (file, k) => {
      try {
        const buf = await file.arrayBuffer();
        const [parse, sha] = [parsePunchWorkbook(new Uint8Array(buf)), await sha256(buf)];
        patch(start + k, { status: "ready", parse, sha });
      } catch (e) {
        patch(start + k, { status: "error", error: e instanceof Error ? e.message : "Could not read the file." });
      }
    });
  }

  async function upload(i: number) {
    const it = items[i];
    if (!it.parse || !it.sha) return;
    patch(i, { status: "uploading", sent: 0 });
    const begin = await beginPunchUpload({ fileName: it.file.name, sha256: it.sha, format: it.parse.format, month: it.parse.month, rows: it.parse.rows.length });
    if ("error" in begin) { patch(i, { status: "error", error: begin.error }); return; }
    for (let k = 0; k < it.parse.rows.length; k += BATCH) {
      const r = await addPunchBatch(begin.fileId, it.parse.rows.slice(k, k + BATCH));
      if ("error" in r) { patch(i, { status: "error", error: r.error }); return; }
      patch(i, { sent: Math.min(k + BATCH, it.parse.rows.length) });
    }
    const done = await finishPunchUpload(begin.fileId);
    patch(i, { status: "done", stored: done.rows });
    router.refresh();
  }

  return (
    <>
      <label className="drop" style={{ display: "block", cursor: "pointer" }}>
        <input type="file" accept=".xlsx,.xls" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        <div className="big"><Icon name="upload" size="lg" /></div>
        <b>Choose punch files</b>
        <div className="dim mt8" style={{ fontSize: 12.5 }}>The raw gate export (&ldquo;Result&rdquo; sheet) or the daily In/Out report, exactly as received · several at once · read on this computer, only the punches are sent</div>
      </label>
      {items.length ? (
        <div className="card mt16">
          <div className="card-h"><h3>Files</h3></div>
          {items.map((it, i) => {
            const wos = Object.entries(it.parse?.workOrders ?? {});
            return (
              <div key={i} className="card-b" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="row wrap">
                  <div className="file-ic">XLSX</div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <b>{it.file.name}</b>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {it.status === "reading" ? "Reading…" : it.parse ? `${it.parse.format === "daily" ? "Daily In/Out report" : "Gate export"} · ${it.parse.rows.length.toLocaleString("en-IN")} punches · month ${it.parse.month ?? "?"}${it.parse.skipped ? ` · ${it.parse.skipped} rows skipped` : ""}` : ""}
                    </div>
                  </div>
                  {it.status === "ready" ? <button className="btn primary" onClick={() => upload(i)}><Icon name="upload" size="sm" />Upload</button> : null}
                  {it.status === "uploading" ? <span className="badge b-blue"><Icon name="loader" className="spin" />Uploading {Math.round(((it.sent ?? 0) / (it.parse?.rows.length || 1)) * 100)}%</span> : null}
                  {it.status === "done" ? <span className="badge b-green"><Icon name="checkCircle" />Stored {it.stored?.toLocaleString("en-IN")} punches</span> : null}
                  {it.status === "error" ? <span className="badge b-red"><Icon name="xCircle" />Not uploaded</span> : null}
                </div>
                {it.error ? <div className="alert err mt8"><Icon name="xCircle" size="sm" /><div>{it.error}</div></div> : null}
                {it.status === "uploading" ? <div className="bar mt8"><i style={{ width: `${((it.sent ?? 0) / (it.parse?.rows.length || 1)) * 100}%` }} /></div> : null}
                {wos.length ? (
                  <table className="tbl compact mt8"><thead><tr><th>Work order</th><th>Unit</th><th className="num">Cards</th><th className="num">Punches</th><th className="num">Access denied</th><th></th></tr></thead>
                    <tbody>{wos.map(([wo, s]) => {
                      const u = woUnit.get(wo);
                      return (<tr key={wo}><td className="mono">{wo}</td><td>{u ?? <span className="badge b-amber">No unit has this work order</span>}</td>
                        <td className="num">{s.cards}</td><td className="num">{s.punches.toLocaleString("en-IN")}</td><td className="num">{s.denied}</td>
                        <td>{it.status === "done" && u && it.parse?.month ? <Link href={`/portal/attendance/time-compliance?unit=${u}&month=${it.parse.month}`}>Time Compliance <Icon name="chevR" size="sm" /></Link> : null}</td></tr>);
                    })}</tbody></table>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
