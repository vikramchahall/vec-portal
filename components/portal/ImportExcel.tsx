"use client";

import { useState, useTransition } from "react";
import { importEmployees, type ActionState } from "@/app/(portal)/portal/actions";
import { Notice, btnGhost, btnPrimary, fieldCls, labelCls } from "./ui";

/** Our columns, and the header names seen on real client master sheets. */
const TARGETS = [
  { key: "emp_code", label: "Employee code", hints: ["employee code", "emp code", "emp no", "register no", "code", "empcode"] },
  { key: "full_name", label: "Name", hints: ["employee name", "name of employee", "name", "emp name"] },
  { key: "father_name", label: "Father's name", hints: ["father name", "father's name", "father"] },
  { key: "designation", label: "Designation", hints: ["designation", "post", "trade"] },
  { key: "category", label: "Grade", hints: ["category", "grade", "skill"] },
  { key: "dob", label: "Date of birth", hints: ["date of birth", "dob", "birth"] },
  { key: "doj", label: "Date of joining", hints: ["date of joining", "doj", "joining"] },
  { key: "mobile", label: "Mobile", hints: ["mobile", "phone", "contact"] },
  { key: "uan", label: "UAN", hints: ["uan", "pf account", "uan / pf account number", "pf no"] },
  { key: "esi_number", label: "ESI number", hints: ["esi number", "esi no", "esic", "ip number"] },
  { key: "bank_name", label: "Bank", hints: ["bank name", "bank"] },
  { key: "bank_account_no", label: "Account no.", hints: ["bank account no", "account no", "a/c no", "account number"] },
  { key: "ifsc", label: "IFSC", hints: ["ifsc code", "ifsc"] },
] as const;

type Mapping = Record<string, string>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Header rows are often not row 1 — find the row that looks most like one. */
function findHeaderRow(grid: unknown[][]): number {
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = (grid[i] ?? []).map((c) => norm(String(c ?? "")));
    const filled = cells.filter(Boolean).length;
    if (filled < 2) continue;

    let score = filled;
    for (const t of TARGETS) {
      if (cells.some((c) => t.hints.some((h) => c === h || c.includes(h)))) {
        score += 12;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function autoMap(headers: string[]): Mapping {
  const map: Mapping = {};
  const used = new Set<string>();

  for (const t of TARGETS) {
    // Exact match first, then contains — otherwise "name" steals
    // "bank name" before "employee name" gets a look in.
    const exact = headers.find(
      (h) => !used.has(h) && t.hints.some((hint) => norm(h) === hint),
    );
    const loose =
      exact ??
      headers.find(
        (h) => !used.has(h) && t.hints.some((hint) => norm(h).includes(hint)),
      );
    if (loose) {
      map[t.key] = loose;
      used.add(loose);
    }
  }
  return map;
}

export default function ImportExcel({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPicked(new Set());
    setState(null);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState(null);
    setFileName(file.name);

    try {
      // SheetJS is ~180 kB. Load it only when a file is actually chosen,
      // so opening a site page does not pay for a feature most visits
      // never use.
      const XLSX = await import("xlsx");

      // Uint8Array + type:"array" is the documented browser path; a bare
      // ArrayBuffer works in Node but throws here.
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array", cellText: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        raw: false,
      });

      if (grid.length === 0) {
        setState({ ok: false, message: "That sheet is empty." });
        return;
      }

      const hIdx = findHeaderRow(grid);
      const head = (grid[hIdx] ?? []).map((c, i) =>
        String(c ?? "").trim() || `Column ${i + 1}`,
      );

      const body = grid
        .slice(hIdx + 1)
        .map((r) => {
          const o: Record<string, string> = {};
          head.forEach((h, i) => {
            o[h] = String(r[i] ?? "").trim();
          });
          return o;
        })
        .filter((r) => Object.values(r).some(Boolean));

      setHeaders(head);
      setRows(body);
      setMapping(autoMap(head));
      setPicked(new Set(body.map((_, i) => i)));
    } catch (err) {
      console.error(err);
      setState({
        ok: false,
        message: `Could not read that file: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    }
  }

  function submit() {
    const nameCol = mapping.full_name;
    if (!nameCol) {
      setState({ ok: false, message: "Map the Name column before importing." });
      return;
    }

    const chosen = [...picked]
      .sort((a, b) => a - b)
      .map((i) => {
        const src = rows[i];
        const out: Record<string, string | null> = {};
        for (const t of TARGETS) {
          const col = mapping[t.key];
          out[t.key] = col ? src[col] || null : null;
        }
        return out;
      });

    start(async () => {
      const res = await importEmployees(siteId, chosen);
      setState(res);
      if (res?.ok) reset();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
        Import from Excel
      </button>
    );
  }

  return (
    <div className="border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-chalk">Import from Excel</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-accent"
        >
          Close
        </button>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-mist">
        Upload the site master sheet. The file is read in your browser — only
        the rows you tick are sent to the database.
      </p>

      <div className="mt-5">
        <label className={labelCls} htmlFor="sheet">
          Spreadsheet (.xlsx, .xlsm, .csv)
        </label>
        <input
          id="sheet"
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={onFile}
          className={`${fieldCls} mt-1.5 file:mr-3 file:border-0 file:bg-raised file:px-3 file:py-1 file:text-[12px] file:text-chalk`}
        />
        {fileName ? (
          <p className="mt-2 text-[11px] text-faint">
            {fileName} · {rows.length} data row{rows.length === 1 ? "" : "s"} found
          </p>
        ) : null}
      </div>

      {headers.length > 0 ? (
        <>
          <div className="mt-7">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Column mapping
            </h4>
            <p className="mt-1.5 text-[11px] text-faint">
              Matched automatically. Correct anything that looks wrong.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TARGETS.map((t) => (
                <div key={t.key}>
                  <label className={labelCls} htmlFor={`map-${t.key}`}>
                    {t.label}
                  </label>
                  <select
                    id={`map-${t.key}`}
                    value={mapping[t.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [t.key]: e.target.value }))
                    }
                    className={`${fieldCls} mt-1.5`}
                  >
                    <option value="">— not in sheet —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Rows to import — {picked.size} of {rows.length} selected
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPicked(new Set(rows.map((_, i) => i)))}
                  className={btnGhost}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setPicked(new Set())}
                  className={btnGhost}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-80 overflow-auto border border-line">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 bg-raised">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    {TARGETS.filter((t) => mapping[t.key]).map((t) => (
                      <th
                        key={t.key}
                        className="whitespace-nowrap px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-faint"
                      >
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const on = picked.has(i);
                    const named = mapping.full_name ? r[mapping.full_name] : "";
                    return (
                      <tr
                        key={i}
                        onClick={() =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className={`cursor-pointer border-t border-line transition-colors ${
                          on ? "bg-brand/5" : "opacity-45"
                        } ${!named ? "line-through" : ""} hover:bg-raised`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={on}
                            readOnly
                            className="pointer-events-none accent-[#e1121b]"
                          />
                        </td>
                        {TARGETS.filter((t) => mapping[t.key]).map((t) => (
                          <td
                            key={t.key}
                            className="whitespace-nowrap px-3 py-2 text-chalk"
                          >
                            {r[mapping[t.key]] || "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Rows with an employee code that already exists on this site are
              updated, not duplicated. Rows without a name are skipped.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <Notice state={state} />
            <button
              type="button"
              onClick={submit}
              disabled={pending || picked.size === 0}
              className={btnPrimary}
            >
              <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
              <span className="relative z-10">
                {pending ? "Importing…" : `Import ${picked.size} row${picked.size === 1 ? "" : "s"}`}
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5">
          <Notice state={state} />
        </div>
      )}
    </div>
  );
}
