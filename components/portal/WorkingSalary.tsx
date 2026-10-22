"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeGeneral,
  computeLine,
  daysInMonth,
  type Attendance,
  type PayrollRules,
  type Structure,
} from "@/lib/payroll";
import { downloadWorkingSalary, monthLabel, type SalaryRow } from "@/lib/excel";
import type { Employee, SkillGrade } from "@/lib/types";
import ImportAttendance, { type AttImport } from "./ImportAttendance";
import ImportWorkingSalary, { type UploadedLine } from "./ImportWorkingSalary";
import MinimumWages, { type WageRow } from "./MinimumWages";
import SalarySlips, { type SlipRow } from "./SalarySlips";
import { Notice, btnGhost, btnPrimary, fieldCls, labelCls } from "./ui";

/**
 * The month only carries four numbers per person: days worked, overtime
 * days, holiday-OT days and night shifts. LOP is derived. Everything else
 * comes from the salary structure or the grade rate, which change twice a
 * year rather than monthly.
 *
 * Measured on ETP January 2026 (59 people): 51 worked the full month and
 * only 9 had overtime. So the screen opens with everyone on a full month
 * and you type the exceptions.
 */
type AttRow = {
  daysWorked: number;
  otDays: number;
  phOtDays: number;
  nightPresents: number;
  holdAmount: number;
};

export type StructureRow = Structure & {
  employee_id: string;
  plant_area: string | null;
};

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
};

const rupee = (v: number) =>
  v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function WorkingSalary({
  site,
  employees,
  structures,
  wages,
  rules,
  initialMonth,
  initialAttendance,
  previousNet,
}: {
  site: {
    id: string;
    code: string;
    name: string;
    header_line_1: string | null;
    header_line_2: string | null;
  };
  employees: Employee[];
  structures: StructureRow[];
  wages: Record<string, WageRow>;
  rules: PayrollRules;
  initialMonth: string;
  initialAttendance: Record<string, AttRow>;
  /** Net salary per employee for the previous month, for the diff. */
  previousNet: Record<string, number>;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [att, setAtt] = useState<Record<string, AttRow>>(initialAttendance);
  const [uploaded, setUploaded] = useState<Record<string, UploadedLine>>({});
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [mode, setMode] = useState<"sheet" | "slips">("sheet");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const dim = daysInMonth(month);

  const overrides = useMemo(
    () => new Map(structures.map((s) => [s.employee_id, s])),
    [structures],
  );

  /**
   * An employee is paid from their own salary structure when one exists,
   * otherwise from the rate for their grade. ETP works off four grade
   * rates for all 59 people; HZL negotiates individually, so the same
   * designation can sit on three different rates. Both are supported.
   */
  const resolve = useMemo(
    () =>
      (e: Employee): (Structure & { plant_area: string | null }) | null => {
        const own = overrides.get(e.id);
        if (own) return own;

        const w = e.category ? wages[e.category as SkillGrade] : undefined;
        if (!w || w.basic <= 0) return null;

        return {
          plant_area: null,
          basic: w.basic,
          da: w.da,
          hra: w.hra,
          conveyance: w.conveyance,
          education: w.education,
          medical: w.medical,
          other: w.other,
          special: w.special,
          nightRate: w.nightRate,
          benevolent: w.benevolent,
          otBase: w.otBase,
        };
      },
    [overrides, wages],
  );

  const active = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const blank: AttRow = {
    daysWorked: dim,
    otDays: 0,
    phOtDays: 0,
    nightPresents: 0,
    holdAmount: 0,
  };

  const get = (id: string): AttRow => att[id] ?? blank;
  const set = (id: string, patch: Partial<AttRow>) =>
    setAtt((a) => ({ ...a, [id]: { ...get(id), ...patch } }));

  const missing = active.filter((e) => resolve(e) === null);

  const computed = useMemo(
    () =>
      active
        .map((e) => ({ e, s: resolve(e) }))
        .filter(
          (x): x is { e: Employee; s: Structure & { plant_area: string | null } } =>
            x.s !== null,
        )
        .map(({ e, s }, i) => {
          const a = get(e.id);
          const attendance: Attendance = { ...a, lop: 0, daysInMonth: dim };
          const line = computeLine(s, attendance, rules);
          const prev = previousNet[e.id];
          const drift =
            prev && prev > 0 ? (line.netSalary - prev) / prev : null;
          const up = uploaded[e.id];

          return {
            employee: e,
            structure: s,
            attendance: a,
            line,
            general: computeGeneral(s, rules),
            slNo: i + 1,
            isException:
              a.daysWorked !== dim ||
              a.otDays > 0 ||
              a.phOtDays > 0 ||
              a.nightPresents > 0,
            drift,
            uploadedNet: up?.net ?? null,
            uploadedDiff: up ? Math.round(up.net - line.netSalary) : null,
          };
        }),
    [active, resolve, att, dim, rules, previousNet, uploaded],
  );

  const shown = onlyExceptions ? computed.filter((r) => r.isException) : computed;

  const totals = useMemo(
    () =>
      computed.reduce(
        (t, r) => ({
          gross: t.gross + r.line.gross,
          earning: t.earning + r.line.totalEarning,
          net: t.net + r.line.netSalary,
          ctc: t.ctc + r.line.ctc,
        }),
        { gross: 0, earning: 0, net: 0, ctc: 0 },
      ),
    [computed],
  );

  const flagged = computed.filter(
    (r) => r.drift !== null && Math.abs(r.drift) > 0.05,
  );
  const mismatched = computed.filter(
    (r) => r.uploadedDiff !== null && Math.abs(r.uploadedDiff) > 1,
  );

  async function save() {
    start(async () => {
      const supabase = createClient();
      const rows = active.map((e) => {
        const a = get(e.id);
        return {
          site_id: site.id,
          employee_id: e.id,
          month,
          days_in_month: dim,
          days_worked: a.daysWorked,
          ot_days: a.otDays,
          ph_ot_days: a.phOtDays,
          night_presents: a.nightPresents,
          hold_amount: a.holdAmount,
        };
      });

      const { error } = await supabase
        .from("attendance_months")
        .upsert(rows, { onConflict: "employee_id,month" });

      setState(
        error
          ? { ok: false, message: `Could not save: ${error.message}` }
          : { ok: true, message: `Saved ${monthLabel(month)}.` },
      );
    });
  }

  async function exportSheet() {
    if (computed.length === 0) {
      setState({ ok: false, message: "Nothing to export." });
      return;
    }
    const rows: SalaryRow[] = computed.map((r) => ({
      empCode: r.employee.emp_code ?? "",
      slNo: r.slNo,
      empNo: String(r.slNo),
      name: r.employee.full_name,
      plantArea: r.structure.plant_area ?? site.code,
      designation: r.employee.designation ?? "",
      category: r.employee.category ?? "",
      doj: r.employee.doj ? r.employee.doj.split("-").reverse().join(".") : "",
      daysWorked: r.attendance.daysWorked,
      lop: Math.max(dim - r.attendance.daysWorked, 0),
      otDays: r.attendance.otDays,
      phOtDays: r.attendance.phOtDays,
      nightPresents: r.attendance.nightPresents,
      line: r.line,
      general: r.general,
    }));

    await downloadWorkingSalary({
      companyName: site.header_line_1 ?? "Vikram Engineering Co.",
      projectLine: site.header_line_2 ?? `Project  : ${site.name}`,
      month,
      daysInMonth: dim,
      otDivisor: rules.otDivisor,
      rows,
      fileName: `Working Salary ${site.code} ${monthLabel(month)}.xlsx`,
    });
  }

  const numCls = `${fieldCls} w-full px-2 py-1.5 text-right text-[12px]`;

  const slipRows: SlipRow[] = computed.map((r) => ({
    employee: r.employee,
    slNo: r.slNo,
    line: r.line,
    daysPaid: r.attendance.daysWorked,
    lop: Math.max(dim - r.attendance.daysWorked, 0),
  }));

  return (
    <div>
      {/* Two jobs on this screen: build the month, then print it. */}
      <div className="mb-7 flex flex-wrap gap-2">
        {([
          ["sheet", "1 · Make working salary"],
          ["slips", "2 · Create salary slips"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`border px-5 py-3 text-[12px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 ${
              mode === k
                ? "border-accent bg-accent text-white"
                : "border-line text-faint hover:text-chalk"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "slips" ? (
        <SalarySlips
          siteId={site.id}
          siteName={site.name}
          siteCode={site.code}
          companyName="Vikram Engineering Co."
          companyAddress="Sushant City - 2, Bathinda (Punjab) - 151001"
          month={month}
          monthLabel={monthLabel(month)}
          rows={slipRows}
        />
      ) : (
      <>
      <div className="mb-6">
        <MinimumWages siteId={site.id} effectiveFrom={month} initial={wages} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className={labelCls} htmlFor="month">
            Month
          </label>
          <input
            id="month"
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(`${e.target.value}-01`)}
            className={`${fieldCls} mt-1.5 w-44`}
          />
          <p className="mt-1.5 text-[11px] text-faint">
            {dim} days · OT divisor {rules.otDivisor} ·{" "}
            {computed.filter((r) => r.isException).length} exception
            {computed.filter((r) => r.isException).length === 1 ? "" : "s"} of{" "}
            {computed.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAtt({})}
            className={btnGhost}
            title="Everyone back to a full month with no overtime"
          >
            Reset to full month
          </button>
          <ImportAttendance
            employees={active.map((e) => ({
              id: e.id,
              emp_code: e.emp_code,
              full_name: e.full_name,
            }))}
            onApply={(incoming: Record<string, AttImport>) =>
              setAtt((prev) => {
                const next = { ...prev };
                for (const [id, v] of Object.entries(incoming)) {
                  const base = next[id] ?? blank;
                  next[id] = {
                    ...base,
                    ...(v.daysWorked !== undefined ? { daysWorked: v.daysWorked } : {}),
                    ...(v.otDays !== undefined ? { otDays: v.otDays } : {}),
                    ...(v.phOtDays !== undefined ? { phOtDays: v.phOtDays } : {}),
                    ...(v.nightPresents !== undefined
                      ? { nightPresents: v.nightPresents }
                      : {}),
                  };
                }
                return next;
              })
            }
          />
          <button type="button" onClick={exportSheet} className={btnGhost}>
            Export
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className={btnPrimary}
          >
            <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
            <span className="relative z-10">{pending ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </div>

      <ImportWorkingSalary
        employees={active.map((e) => ({
          id: e.id,
          emp_code: e.emp_code,
          full_name: e.full_name,
        }))}
        onApply={(lines, attendance) => {
          setUploaded(lines);
          if (Object.keys(attendance).length) {
            setAtt((prev) => {
              const next = { ...prev };
              for (const [id, v] of Object.entries(attendance)) {
                const base = next[id] ?? blank;
                next[id] = {
                  ...base,
                  ...(v.daysWorked !== undefined ? { daysWorked: v.daysWorked } : {}),
                  ...(v.otDays !== undefined ? { otDays: v.otDays } : {}),
                  ...(v.phOtDays !== undefined ? { phOtDays: v.phOtDays } : {}),
                  ...(v.nightPresents !== undefined
                    ? { nightPresents: v.nightPresents }
                    : {}),
                };
              }
              return next;
            });
          }
        }}
      />

      <div className="mt-4">
        <Notice state={state} />
      </div>

      {missing.length > 0 ? (
        <p className="mt-4 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[12px] leading-relaxed text-accent-lit">
          {missing.length} employee{missing.length === 1 ? " has" : "s have"} no
          salary yet. Import the general salary sheet, or set a grade rate:{" "}
          {missing.slice(0, 6).map((e) => e.full_name).join(", ")}
          {missing.length > 6 ? "…" : ""}.
        </p>
      ) : null}

      {flagged.length > 0 ? (
        <p className="mt-4 border-l-2 border-brand bg-brand/10 py-3 pl-4 text-[12px] leading-relaxed text-chalk">
          {flagged.length} net salar{flagged.length === 1 ? "y has" : "ies have"}{" "}
          moved more than 5% since last month. Worth a glance before printing —
          the column is marked below.
        </p>
      ) : null}

      {mismatched.length > 0 ? (
        <p className="mt-4 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[12px] leading-relaxed text-accent-lit">
          {mismatched.length} row{mismatched.length === 1 ? "" : "s"} disagree
          with the uploaded sheet by more than ₹1. See the Uploaded column.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
        {[
          ["Gross", totals.gross],
          ["Total earning", totals.earning],
          ["Net payable", totals.net],
          ["CTC", totals.ctc],
        ].map(([label, v]) => (
          <div key={String(label)} className="bg-surface px-4 py-5 text-center">
            <p className="font-display text-lg text-chalk">₹{rupee(Number(v))}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-faint">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-chalk">
          <input
            type="checkbox"
            checked={onlyExceptions}
            onChange={(e) => setOnlyExceptions(e.target.checked)}
            className="accent-[#e1121b]"
          />
          Show only exceptions
        </label>
        <span className="text-[11px] text-faint">
          Everyone starts on a full month. Type only what differs.
        </span>
      </div>

      <div className="mt-4 overflow-x-auto border border-line">
        <table className="w-full min-w-[1000px] border-collapse text-[12px]">
          <thead className="bg-raised">
            <tr className="text-left">
              {["#", "Name", "Grade", "Days", "OT", "HP", "Nights", "Hold",
                "LOP", "Gross", "Net", "vs last", "Uploaded"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const a = r.attendance;
              const id = r.employee.id;
              const lop = Math.max(dim - a.daysWorked, 0);
              return (
                <tr
                  key={id}
                  className={`border-t border-line hover:bg-deep ${
                    r.isException ? "bg-brand/[0.04]" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 text-faint">{r.slNo}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className="font-medium text-chalk">
                      {r.employee.full_name}
                    </span>
                    <span className="ml-2 text-[10px] text-faint">
                      {r.employee.designation ?? ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-faint">
                    {r.employee.category ?? "—"}
                  </td>

                  <td className="px-1 py-1">
                    <input
                      type="number" min={0} max={dim} step={0.5}
                      value={a.daysWorked}
                      onChange={(e) => set(id, { daysWorked: n(e.target.value) })}
                      className={numCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number" min={0} step={0.125} value={a.otDays}
                      onChange={(e) => set(id, { otDays: n(e.target.value) })}
                      className={numCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number" min={0} step={0.125} value={a.phOtDays}
                      onChange={(e) => set(id, { phOtDays: n(e.target.value) })}
                      className={numCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number" min={0} step={1} value={a.nightPresents}
                      onChange={(e) => set(id, { nightPresents: n(e.target.value) })}
                      className={numCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number" min={0} step={1} value={a.holdAmount}
                      onChange={(e) => set(id, { holdAmount: n(e.target.value) })}
                      className={numCls}
                    />
                  </td>

                  <td className="px-3 py-1.5 text-right text-faint">{lop || "—"}</td>
                  <td className="px-3 py-1.5 text-right text-mist">
                    {rupee(r.line.gross)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-chalk">
                    {rupee(r.line.netSalary)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    {r.drift === null ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <span
                        className={
                          Math.abs(r.drift) > 0.05
                            ? "font-medium text-accent"
                            : "text-faint"
                        }
                      >
                        {r.drift > 0 ? "+" : ""}
                        {(r.drift * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    {r.uploadedNet === null ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <span
                        className={
                          Math.abs(r.uploadedDiff ?? 0) > 1
                            ? "font-medium text-accent"
                            : "text-faint"
                        }
                        title={`Uploaded ₹${rupee(r.uploadedNet)}`}
                      >
                        {r.uploadedDiff === 0
                          ? "match"
                          : `${(r.uploadedDiff ?? 0) > 0 ? "+" : ""}${rupee(r.uploadedDiff ?? 0)}`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Four numbers per person; LOP is derived. OT and HP are in{" "}
        <strong>days</strong> — divide hours by 8. <strong>vs last</strong>{" "}
        compares net against the previous month. <strong>Uploaded</strong>{" "}
        appears once you import the client&apos;s own sheet.
      </p>
      </>
      )}
    </div>
  );
}
