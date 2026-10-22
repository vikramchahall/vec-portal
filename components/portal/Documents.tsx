"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDocument,
  getDocumentUrl,
  recordDocument,
  type ActionState,
} from "@/app/(portal)/portal/actions";
import { DOCUMENT_TYPES, type EmployeeDocument } from "@/lib/types";
import { Notice, btnGhost, fieldCls, labelCls } from "./ui";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Shrinks a photograph before upload: longest edge 1600px, JPEG quality
 * 0.72. An Aadhaar photo off a phone is typically 3–5 MB and lands around
 * 150–300 KB, which is the difference between the free Supabase tier
 * lasting years and filling up in a month.
 *
 * PDFs cannot be recompressed in the browser, so they pass through and
 * are simply size-capped.
 */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.72),
    );
    if (!blob) return file;

    // Occasionally a small, already-optimised image gets bigger. Keep
    // whichever is smaller.
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

const kb = (n: number | null) =>
  n == null ? "" : n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

export default function Documents({
  employeeId,
  siteId,
  documents,
}: {
  employeeId: string;
  siteId: string;
  documents: EmployeeDocument[];
}) {
  const [state, setState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("aadhaar");
  const [pending, start] = useTransition();

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setState(null);

    try {
      const original = file.size;
      const prepared = await compress(file);

      if (prepared.size > MAX_BYTES) {
        setState({
          ok: false,
          message: `That file is ${kb(prepared.size)}. The limit is 5 MB — please scan at a lower quality.`,
        });
        return;
      }

      const ext = prepared.name.split(".").pop()?.toLowerCase() || "bin";
      // First path segment must be the employee id — the storage policy
      // reads it to decide access.
      const path = `${employeeId}/${crypto.randomUUID()}.${ext}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("employee-docs")
        .upload(path, prepared, { contentType: prepared.type, upsert: false });

      if (error) {
        setState({ ok: false, message: `Upload failed: ${error.message}` });
        return;
      }

      const res = await recordDocument({
        employeeId,
        siteId,
        type,
        label: prepared.name,
        filePath: path,
        fileSize: prepared.size,
        mimeType: prepared.type,
      });

      const saved = original - prepared.size;
      setState(
        res?.ok && saved > 20_000
          ? {
              ok: true,
              message: `Uploaded — compressed ${kb(original)} down to ${kb(prepared.size)}.`,
            }
          : res,
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function open(path: string) {
    const url = await getDocumentUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setState({ ok: false, message: "Could not open that document." });
  }

  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        Documents
      </h4>

      {documents.length > 0 ? (
        <ul className="mt-3 divide-y divide-line border border-line">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => open(d.file_path)}
                className="link-underline min-w-0 flex-1 text-left text-[12px] text-chalk"
              >
                <span className="font-medium">
                  {DOCUMENT_TYPES.find((t) => t.value === d.type)?.label ?? d.type}
                </span>
                <span className="ml-2 truncate text-faint">
                  {d.label} · {kb(d.file_size)}
                </span>
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteDocument(d.id, d.file_path, siteId);
                    setState(res);
                  })
                }
                className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-faint hover:text-accent"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-faint">Nothing uploaded yet.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className={labelCls} htmlFor={`t-${employeeId}`}>
            Type
          </label>
          <select
            id={`t-${employeeId}`}
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={`${fieldCls} mt-1.5`}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor={`f-${employeeId}`}>
            File — images are compressed automatically
          </label>
          <input
            id={`f-${employeeId}`}
            type="file"
            accept="image/*,.pdf"
            disabled={busy}
            onChange={upload}
            className={`${fieldCls} mt-1.5 file:mr-3 file:border-0 file:bg-raised file:px-3 file:py-1 file:text-[12px] file:text-chalk`}
          />
        </div>
      </div>

      {busy ? (
        <p className="mt-3 text-[12px] text-mist">Compressing and uploading…</p>
      ) : (
        <div className="mt-3">
          <Notice state={state} />
        </div>
      )}
    </div>
  );
}
