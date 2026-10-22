"use client";

import { useState } from "react";
import type { Sheet, Workbook } from "@/lib/sheet";
import { fieldCls, labelCls } from "./ui";

export type Target = { key: string; label: string; hints: readonly string[] };

/**
 * Shows the actual spreadsheet and lets you assign columns by clicking
 * them, rather than guessing from a list of header names.
 *
 * Pick a field on the left, click its column in the grid. Assigned columns
 * are tinted and labelled. This is the same thing you would do by eye in
 * Excel, which is why it beats a wall of dropdowns when headers are blank,
 * duplicated or spread across two rows.
 */
export default function SheetMapper({
  workbook,
  sheet,
  targets,
  mapping,
  onSheetChange,
  onMappingChange,
  required = [],
}: {
  workbook: Workbook;
  sheet: Sheet;
  targets: Target[];
  mapping: Record<string, string>;
  onSheetChange: (name: string) => void;
  onMappingChange: (m: Record<string, string>) => void;
  required?: string[];
}) {
  const [armed, setArmed] = useState<string | null>(targets[0]?.key ?? null);

  const assignedTo = (header: string) =>
    targets.find((t) => mapping[t.key] === header);

  function clickColumn(header: string) {
    if (!armed) return;
    const next = { ...mapping };
    // A column can only fill one field; clear any previous holder.
    for (const k of Object.keys(next)) if (next[k] === header) delete next[k];
    next[armed] = header;
    onMappingChange(next);

    // Advance to the next unmapped field so you can click straight down.
    const i = targets.findIndex((t) => t.key === armed);
    const nextTarget =
      targets.slice(i + 1).find((t) => !next[t.key]) ??
      targets.find((t) => !next[t.key]);
    setArmed(nextTarget?.key ?? null);
  }

  const preview = sheet.grid.slice(sheet.headerRow, sheet.headerRow + 9);
  const missing = required.filter((k) => !mapping[k]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={labelCls} htmlFor="sheet-pick">
            Sheet
          </label>
          <select
            id="sheet-pick"
            value={sheet.name}
            onChange={(e) => onSheetChange(e.target.value)}
            className={`${fieldCls} mt-1.5 w-64`}
          >
            {workbook.sheetNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2.5 text-[11px] text-faint">
          Header found on row {sheet.headerRow + 1} · {sheet.rows.length} data
          rows
        </p>
      </div>

      {/* Field chips ------------------------------------------------- */}
      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Click a field, then click its column below
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {targets.map((t) => {
            const on = armed === t.key;
            const got = mapping[t.key];
            const needed = required.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setArmed(on ? null : t.key)}
                className={`border px-3 py-1.5 text-left text-[11px] transition-colors duration-200 ${
                  on
                    ? "border-accent bg-accent text-white"
                    : got
                      ? "border-line bg-raised text-chalk"
                      : needed
                        ? "border-accent/40 text-accent"
                        : "border-line text-faint hover:text-chalk"
                }`}
              >
                <span className="block font-medium">
                  {t.label}
                  {needed ? " *" : ""}
                </span>
                <span
                  className={`block text-[10px] ${on ? "text-white/80" : "text-faint"}`}
                >
                  {got ? got.slice(0, 22) : "not set"}
                </span>
              </button>
            );
          })}
          {Object.keys(mapping).length > 0 ? (
            <button
              type="button"
              onClick={() => onMappingChange({})}
              className="border border-line px-3 py-1.5 text-[11px] text-faint hover:text-accent"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {/* The sheet itself -------------------------------------------- */}
      <div className="mt-5 max-h-[420px] overflow-auto border border-line">
        <table className="border-collapse text-[11px]">
          <tbody>
            {preview.map((row, ri) => {
              const isHeader = ri === 0;
              return (
                <tr key={ri} className={isHeader ? "sticky top-0 z-10" : ""}>
                  {sheet.headers.map((h, ci) => {
                    const owner = assignedTo(h);
                    const cell = row[ci] ?? "";
                    return (
                      <td
                        key={ci}
                        onClick={() => clickColumn(h)}
                        title={h}
                        className={`cursor-pointer whitespace-nowrap border-r border-line px-2 py-1.5 transition-colors ${
                          isHeader
                            ? "bg-raised font-medium text-chalk"
                            : "border-t text-mist"
                        } ${
                          owner
                            ? "bg-brand/10 text-chalk"
                            : armed
                              ? "hover:bg-accent/10"
                              : ""
                        }`}
                      >
                        {isHeader && owner ? (
                          <span className="mr-1.5 bg-accent px-1 py-0.5 text-[8px] uppercase tracking-wider text-white">
                            {owner.label}
                          </span>
                        ) : null}
                        {cell.slice(0, 24) || (isHeader ? h.slice(0, 18) : "")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-faint">
        Showing the header row and the first 8 data rows. Scroll sideways for
        more columns.
      </p>

      {missing.length > 0 ? (
        <p className="mt-3 border-l-2 border-accent bg-accent/10 py-2.5 pl-3 text-[12px] text-accent-lit">
          Still needed:{" "}
          {missing
            .map((k) => targets.find((t) => t.key === k)?.label ?? k)
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}
