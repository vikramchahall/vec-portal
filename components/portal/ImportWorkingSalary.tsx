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

export type UploadedLine = { net: number; gross: number | null };

export type AttPatch = {
  daysWorked?: number;
  otDays?: number;
  phOtDays?: number;
  nightPresents?: number;
};

/**
 * Reads a completed Working Salary sheet — the client's, or one of yours
 * from an earlier month.
 *
 * Two things come out: the attendance, which fills the grid; and the
 * sheet's own Net Salary, shown beside our computed net so any
 * disagreement is visible before slips print. The uploaded figure is
 * never silently adopted.
 */
const TARGETS: Target[] = [
  { key: "empCode", label: "Employee code", hints: ["employee code", "emp code", "emp no", "register no", "code"] },
  { key: "name", label: "Name", hints: ["employee name", "name"] },
  { key: "days", label: "Days payable", hints: ["no of days payable", "no of days work ed", "days payable", "total days pybl", "days worked", "days"] },
  { key: "ot", label: "OT days", hints: ["ot days", "ot"] },
  { key: "hp", label: "Holiday OT", hints: ["ph o t", "ph ot", "hp", "holiday"] },
  { key: "np", label: "Nights", hints: ["np", "night"] },
  { key: "gross", label: "Gross", hints: ["gross salary", "gross"] },
  { key: "net", label: "Net salary", hints: ["net salary", "net"] },
];

const HINTS = TARGETS.map((t) => [...t.hints]);

export default function ImportWorkingSalary({
  employees,
  onApply,
}: {
  employees: { id: string; emp_code: string | null; full_name: string }[];
  onApply: (
    lines: Record<string, UploadedLine>,
    attendance: Record<string, AttPatch>,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [takeAttendance, setTakeAttendance] = useState(true);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);

  function load(book: Workbook, name: string) {
    const s = book.read(name);
    setSheet(s);
    // Gross and Net repeat twice on this sheet — once for the month, once
    // for the General block. Default to the FIRST, which is the month.
    setMapping(autoMap(s.headers, TARGETS));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState(null);

    try {
      const book = await readWorkbook(file, HINTS);
      setWb(book);
      load(book, pickSheet(book.sheetNames, [/working\s*salary/i]));
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

    const lines: Record<string, UploadedLine> = {};
    const attendance: Record<string, AttPatch> = {};
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

      const net = toNumber(get(r, "net"));
      if (net !== undefined) {
        lines[id] = { net, gross: toNumber(get(r, "gross")) ?? null };
      }

      if (takeAttendance) {
        attendance[id] = {
          daysWorked: toNumber(get(r, "days")),
          otDays: toNumber(get(r, "ot")),
          phOtDays: toNumber(get(r, "hp")),
          nightPresents: toNumber(get(r, "np")),
        };
      }
      matched++;
    }

    if (matched === 0) {
      setState({
        ok: false,
        message: "No rows matched an employee. Map the code or name column.",
      });
      return;
    }

    onApply(lines, attendance);
    setState({
      ok: true,
      message:
        `Compared ${matched} row${matched === 1 ? "" : "s"}.` +
        (unmatched.length
          ? ` ${unmatched.length} not matched: ${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}.`
          : "") +
        " Differences show in the Uploaded column.",
    });
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
          Upload working salary to compare
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-chalk">
          Upload working salary
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
        Its attendance fills the grid, and its Net Salary is shown beside ours
        so any disagreement is visible before slips go out.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_240px]">
        <div>
          <label className={labelCls} htmlFor="ws-file">
            Spreadsheet (.xlsx, .xlsm, .csv)
          </label>
          <input
            id="ws-file"
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            onChange={onFile}
            className={`${fieldCls} mt-1.5 file:mr-3 file:border-0 file:bg-raised file:px-3 file:py-1 file:text-[12px] file:text-chalk`}
          />
        </div>
        <label className="flex items-end gap-2 pb-3 text-[12px] text-chalk">
          <input
            type="checkbox"
            checked={takeAttendance}
            onChange={(e) => setTakeAttendance(e.target.checked)}
            className="accent-[#e1121b]"
          />
          Also fill attendance
        </label>
      </div>

      {wb && sheet ? (
        <>
          <SheetMapper
            workbook={wb}
            sheet={sheet}
            targets={TARGETS}
            mapping={mapping}
            required={["net"]}
            onSheetChange={(n) => load(wb, n)}
            onMappingChange={setMapping}
          />
          <div className="mt-5">
            <button type="button" onClick={apply} className={btnGhost}>
              Compare {sheet.rows.length} rows
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
