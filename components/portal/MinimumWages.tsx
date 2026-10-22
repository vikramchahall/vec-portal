"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { SKILL_GRADES, type SkillGrade } from "@/lib/types";
import { Notice, btnGhost, btnPrimary, fieldCls, labelCls } from "./ui";

export type WageRow = {
  category: SkillGrade;
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  education: number;
  medical: number;
  other: number;
  special: number;
  nightRate: number;
  benevolent: number;
  otBase: "mw" | "gross";
};

export const emptyWage = (category: SkillGrade): WageRow => ({
  category,
  basic: 0,
  da: 0,
  hra: 0,
  conveyance: 0,
  education: 0,
  medical: 0,
  other: 0,
  special: 0,
  nightRate: 0,
  benevolent: 0,
  otBase: "mw",
});

const FIELDS = [
  ["basic", "Basic"],
  ["da", "DA"],
  ["hra", "HRA"],
  ["conveyance", "Conveyance"],
  ["education", "Education"],
  ["medical", "Medical"],
  ["other", "Other"],
  ["special", "Special"],
  ["nightRate", "Night / shift"],
  ["benevolent", "Benevolent"],
] as const;

/**
 * The monthly rate each skill grade earns at this site. An employee with
 * no individual salary structure is paid from their grade's row, which is
 * how a newly imported worker gets a correct salary with no extra typing.
 */
export default function MinimumWages({
  siteId,
  effectiveFrom,
  initial,
}: {
  siteId: string;
  effectiveFrom: string;
  initial: Record<string, WageRow>;
}) {
  // Never auto-open. Most sites pay individually negotiated rates read
  // straight from the spreadsheet, so grade rates are an optional
  // convenience, not a step you must complete.
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, WageRow>>(() =>
    Object.fromEntries(
      SKILL_GRADES.map((g) => [g, initial[g] ?? emptyWage(g)]),
    ),
  );
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (g: SkillGrade, patch: Partial<WageRow>) =>
    setRows((r) => ({ ...r, [g]: { ...r[g], ...patch } }));

  const num = (v: string) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };

  function save() {
    start(async () => {
      const supabase = createClient();

      // Only save grades that have actually been given a basic rate —
      // writing five empty rows would make every grade look configured.
      const payload = SKILL_GRADES.filter((g) => rows[g].basic > 0).map((g) => ({
        site_id: siteId,
        category: g,
        effective_from: effectiveFrom,
        basic: rows[g].basic,
        da: rows[g].da,
        hra: rows[g].hra,
        conveyance: rows[g].conveyance,
        education: rows[g].education,
        medical: rows[g].medical,
        other: rows[g].other,
        special: rows[g].special,
        night_rate: rows[g].nightRate,
        benevolent: rows[g].benevolent,
        ot_base: rows[g].otBase,
      }));

      if (payload.length === 0) {
        setState({ ok: false, message: "Enter a basic rate for at least one grade." });
        return;
      }

      const { error } = await supabase
        .from("minimum_wages")
        .upsert(payload, { onConflict: "site_id,category,effective_from" });

      setState(
        error
          ? { ok: false, message: `Could not save: ${error.message}` }
          : {
              ok: true,
              message: `Saved ${payload.length} grade${payload.length === 1 ? "" : "s"}, effective ${effectiveFrom}. Reload to apply.`,
            },
      );
    });
  }

  const configured = SKILL_GRADES.filter((g) => rows[g].basic > 0).length;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-line bg-surface px-5 py-3">
        <span className="text-[12px] text-mist">
          {configured > 0
            ? `Grade rates: ${configured} of ${SKILL_GRADES.length} set`
            : "Grade rates — optional. Salaries come from the imported sheet."}
        </span>
        <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
          Edit rates
        </button>
      </div>
    );
  }

  return (
    <div className="border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-chalk">
            Minimum wages by grade
          </h3>
          <p className="mt-1 text-[12px] text-mist">
            Optional. Salaries normally come from the imported general
            salary sheet; these rates are only a fallback for anyone who
            has no structure of their own. Effective {effectiveFrom}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-accent"
        >
          Collapse
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead className="bg-raised">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-faint">
                Grade
              </th>
              {FIELDS.map(([, label]) => (
                <th
                  key={label}
                  className="px-2 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-faint"
                >
                  {label}
                </th>
              ))}
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-faint">
                OT on
              </th>
            </tr>
          </thead>
          <tbody>
            {SKILL_GRADES.map((g) => (
              <tr key={g} className="border-t border-line">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-chalk">
                  {g}
                </td>
                {FIELDS.map(([key]) => (
                  <td key={key} className="px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={rows[g][key]}
                      onChange={(e) => set(g, { [key]: num(e.target.value) })}
                      className={`${fieldCls} w-24 px-2 py-1.5 text-right`}
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <select
                    value={rows[g].otBase}
                    onChange={(e) =>
                      set(g, { otBase: e.target.value as "mw" | "gross" })
                    }
                    className={`${fieldCls} w-28 px-2 py-1.5`}
                  >
                    <option value="mw">Basic + DA</option>
                    <option value="gross">Gross</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        <strong className="text-mist">OT on</strong> decides the overtime base.
        Your July-2026 sheet pays helpers on Basic + DA and engineers on Gross.
        Overtime is always calculated on the full monthly rate, never the
        pro-rated one.
      </p>

      <div className="mt-5 space-y-4">
        <Notice state={state} />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={btnPrimary}
        >
          <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
          <span className="relative z-10">
            {pending ? "Saving…" : "Save rates"}
          </span>
        </button>
      </div>
    </div>
  );
}
