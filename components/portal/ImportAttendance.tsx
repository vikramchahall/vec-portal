"use client";

import { useState } from "react";
import {
  autoMap,
  pickSheet,
  readWorkbook,
  toNumber,
  type Sheet,
  type Workbook,
} from "@/lib/sheet";
import SheetMapper, { type Target } from "./SheetMapper";
import { btnGhost, fieldCls, labelCls, Notice } from "./ui";

export type AttImport = {
  daysWorked?: number;
  otDays?: number;
  phOtDays?: number;
  nightPresents?: number;
};

const TARGETS: Target[] = [
  { key: "empCode", label: "Employee code", hints: ["employee code", "emp code", "emp no", "register no", "code"] },
  { key: "name", label: "Name", hints: ["employee name", "name"] },
  { key: "daysWorked", label: "Days worked", hints: ["total days pybl", "days payable", "no of days worked", "days worked", "total days", "present", "days"] },
  { key: "otDays", label: "OT days", hints: ["ot days payable", "ot days", "overtime days", "ot"] },
  { key: "otHours", label: "OT hours", hints: ["total hours", "ot hours", "general o t hours", "overtime hours"] },
  { key: "phOtDays", label: "Holiday OT", hints: ["h w o t", "holiday ot", "ph o t", "ph ot", "hp"] },
  { key: "nightPresents", label: "Nights", hints: ["np", "night", "night presents"] },
];

const HINTS = TARGETS.map((t) => [...t.hints]);

/**
 * Reads an attendance sheet and hands the matched rows to the grid.
 * Nothing is written to the database here — the figures land in the
 * editable table first so they can be checked.
 */
export default function ImportAttendance({
  employees,
  onApply,
}: {
  employees: { id: string; emp_code: string | null; full_name: string }[];
  onApply: (rows: Record<string, AttImport>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);

  function load(book: Workbook, name: string) {
    const s = book.read(name);
    setSheet(s);
    setMapping(autoMap(s.headers, TARGETS));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState(null);

    try {
      const book = await readWorkbook(file, HINTS);
      setWb(book);
      load(book, pickSheet(book.sheetNames, [/attend/i, /ot/i]));
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

  function apply() {
    if (!sheet) return;

    const byCode = new Map(
      employees.filter((e) => e.emp_code).map((e) => [e.emp_code!.toLowerCase(), e.id]),
    );
    const byName = new Map(
      employees.map((e) => [e.full_name.toLowerCase().replace(/\s+/g, " "), e.id]),
    );

    const out: Record<string, AttImport> = {};
    let matched = 0;
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

      // OT may arrive as days or as hours; hours convert at 8 per day.
      const otDays = toNumber(get(r, "otDays"));
      const otHours = toNumber(get(r, "otHours"));

      out[id] = {
        daysWorked: toNumber(get(r, "daysWorked")),
        otDays: otDays ?? (otHours !== undefined ? otHours / 8 : undefined),
        phOtDays: toNumber(get(r, "phOtDays")),
        nightPresents: toNumber(get(r, "nightPresents")),
      };
      matched++;
    }

    if (matched === 0) {
      setState({
        ok: false,
        message: "No rows matched an employee. Map the code or name column.",
      });
      return;
    }

    onApply(out);
    setState({
      ok: true,
      message:
        `Applied ${matched} row${matched === 1 ? "" : "s"} to the grid.` +
        (unmatched.length
          ? ` ${unmatched.length} not matched: ${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}.`
          : "") +
        " Nothing is saved until you press Save.",
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
        Import attendance
      </button>
    );
  }

  return (
    <div className="mt-5 w-full border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-chalk">Import attendance</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-accent"
        >
          Close
        </button>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-mist">
        Rows are matched by employee code, falling back to name. The figures
        land in the grid for checking — nothing is saved until you press Save.
      </p>

      <div className="mt-5">
        <label className={labelCls} htmlFor="att-file">
          Spreadsheet (.xlsx, .xlsm, .csv)
        </label>
        <input
          id="att-file"
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={onFile}
          className={`${fieldCls} mt-1.5 file:mr-3 file:border-0 file:bg-raised file:px-3 file:py-1 file:text-[12px] file:text-chalk`}
        />
      </div>

      {wb && sheet ? (
        <>
          <SheetMapper
            workbook={wb}
            sheet={sheet}
            targets={TARGETS}
            mapping={mapping}
            required={["daysWorked"]}
            onSheetChange={(n) => load(wb, n)}
            onMappingChange={setMapping}
          />
          <div className="mt-5">
            <button type="button" onClick={apply} className={btnGhost}>
              Apply {sheet.rows.length} rows to grid
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
