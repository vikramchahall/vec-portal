"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  autoMap,
  pickSheet,
  readWorkbook,
  toNumber,
  type Sheet,
  type Workbook,
} from "@/lib/sheet";
import SheetMapper, { type Target } from "./SheetMapper";
import { btnGhost, btnPrimary, fieldCls, labelCls, Notice } from "./ui";

/**
 * Imports each person's full monthly rate into salary_structures.
 *
 * This is the import that pays off most: once a site's rates are in, every
 * later month needs nothing but attendance.
 */
const TARGETS: Target[] = [
  { key: "empCode", label: "Employee code", hints: ["employee code", "emp code", "emp no", "register no", "code"] },
  { key: "name", label: "Name", hints: ["employee name", "name"] },
  { key: "basic", label: "Basic", hints: ["basic salary", "basic + da", "basic da", "basic"] },
  { key: "da", label: "DA", hints: ["da", "dearness"] },
  { key: "hra", label: "HRA", hints: ["house rent allowance", "hra"] },
  { key: "conveyance", label: "Conveyance", hints: ["conveyance allowance", "conveyance"] },
  { key: "special", label: "Special", hints: ["special allowance", "special"] },
  { key: "education", label: "Education", hints: ["education allowance", "children education", "education"] },
  { key: "medical", label: "Medical", hints: ["medical allowance", "medical"] },
  { key: "other", label: "Other", hints: ["fixed other allowance", "other allowance", "other"] },
];

const HINTS = TARGETS.map((t) => [...t.hints]);

/** Money columns repeat on a Working Salary sheet; the later one is the
 *  General block, which holds the full monthly rate. */
const PREFER_LAST = TARGETS.filter(
  (t) => !["empCode", "name"].includes(t.key),
).map((t) => t.key);

export default function ImportStructures({
  siteId,
  effectiveFrom,
  employees,
}: {
  siteId: string;
  effectiveFrom: string;
  employees: { id: string; emp_code: string | null; full_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [otBase, setOtBase] = useState<"mw" | "gross">("gross");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function load(book: Workbook, name: string) {
    const s = book.read(name);
    setSheet(s);
    setMapping(autoMap(s.headers, TARGETS, PREFER_LAST));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState(null);

    try {
      const book = await readWorkbook(file, HINTS);
      setWb(book);
      load(
        book,
        pickSheet(book.sheetNames, [/general\s*salary/i, /working\s*salary/i, /master/i]),
      );
      setState({ ok: true, message: `Opened ${file.name}.` });
    } catch (err) {
      console.error(err);
      setState({
        ok: false,
        message: `Could not read that file: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      });
    }
  }

  function save() {
    if (!sheet) return;

    const byCode = new Map(
      employees.filter((e) => e.emp_code).map((e) => [e.emp_code!.toLowerCase(), e.id]),
    );
    const byName = new Map(
      employees.map((e) => [e.full_name.toLowerCase().replace(/\s+/g, " "), e.id]),
    );

    const payload: Record<string, unknown>[] = [];
    const unmatched: string[] = [];
    const get = (r: Record<string, string>, k: string) =>
      mapping[k] ? r[mapping[k]] : undefined;

    for (const r of sheet.rows) {
      const code = (get(r, "empCode") ?? "").trim();
      const name = (get(r, "name") ?? "").trim();
      const id =
        (code && byCode.get(code.toLowerCase())) ||
        (name && byName.get(name.toLowerCase().replace(/\s+/g, " ")));

      if (!id) {
        if (code || name) unmatched.push(code || name);
        continue;
      }

      const basic = toNumber(get(r, "basic")) ?? 0;
      if (basic <= 0) continue;

      payload.push({
        employee_id: id,
        effective_from: effectiveFrom,
        basic,
        da: toNumber(get(r, "da")) ?? 0,
        hra: toNumber(get(r, "hra")) ?? 0,
        conveyance: toNumber(get(r, "conveyance")) ?? 0,
        education: toNumber(get(r, "education")) ?? 0,
        medical: toNumber(get(r, "medical")) ?? 0,
        other: toNumber(get(r, "other")) ?? 0,
        special: toNumber(get(r, "special")) ?? 0,
        ot_base: otBase,
      });
    }

    if (payload.length === 0) {
      setState({
        ok: false,
        message: "Nothing to save. Map the code or name column, and Basic.",
      });
      return;
    }

    start(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("salary_structures")
        .upsert(payload, { onConflict: "employee_id,effective_from" });

      if (error) {
        const hint = /special|column/.test(error.message)
          ? " Run docs/sql/07-patch-columns.sql — your database is missing a column this build expects."
          : "";
        setState({ ok: false, message: `Could not save: ${error.message}.${hint}` });
        return;
      }

      setState({
        ok: true,
        message:
          `Saved ${payload.length} salary structure${payload.length === 1 ? "" : "s"}, effective ${effectiveFrom}.` +
          (unmatched.length
            ? ` ${unmatched.length} row(s) matched no employee: ${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}.`
            : "") +
          " Reload to see the salaries.",
      });
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
        Import general salary
      </button>
    );
  }

  return (
    <div className="mt-5 border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-chalk">
          Import general salary
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-accent"
        >
          Close
        </button>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-mist">
        Each person&apos;s full monthly rate, saved as their salary structure
        effective {effectiveFrom}. Read entirely in your browser — the file is
        never uploaded anywhere.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_220px]">
        <div>
          <label className={labelCls} htmlFor="gs-file">
            Spreadsheet (.xlsx, .xlsm, .csv)
          </label>
          <input
            id="gs-file"
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            onChange={onFile}
            className={`${fieldCls} mt-1.5 file:mr-3 file:border-0 file:bg-raised file:px-3 file:py-1 file:text-[12px] file:text-chalk`}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="gs-otbase">
            Overtime paid on
          </label>
          <select
            id="gs-otbase"
            value={otBase}
            onChange={(e) => setOtBase(e.target.value as "mw" | "gross")}
            className={`${fieldCls} mt-1.5`}
          >
            <option value="gross">Gross</option>
            <option value="mw">Basic + DA</option>
          </select>
        </div>
      </div>

      {wb && sheet ? (
        <>
          <SheetMapper
            workbook={wb}
            sheet={sheet}
            targets={TARGETS}
            mapping={mapping}
            required={["basic"]}
            onSheetChange={(n) => load(wb, n)}
            onMappingChange={setMapping}
          />
          <div className="mt-5">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={btnPrimary}
            >
              <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
              <span className="relative z-10">
                {pending ? "Saving…" : `Save ${sheet.rows.length} rows`}
              </span>
            </button>
          </div>
        </>
      ) : null}

      <div className="mt-4">
        <Notice state={state} />
      </div>
    </div>
  );
}
