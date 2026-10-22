"use client";

import { useMemo } from "react";
import type { Employee } from "@/lib/types";

/** Small horizontal bar chart — no charting library for four bars. */
function Bars({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="border border-line bg-surface p-6">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        {title}
      </h3>
      <ul className="mt-5 space-y-3">
        {data.length === 0 ? (
          <li className="text-[12px] text-faint">No data yet.</li>
        ) : (
          data.map((d) => (
            <li key={d.label}>
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="truncate text-chalk">{d.label}</span>
                <span className="shrink-0 font-display text-chalk">{d.value}</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-raised">
                <div
                  className="h-full bg-brand transition-[width] duration-700"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const tally = (rows: (string | null)[], limit = 10) => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r ?? "—").trim() || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};

export default function Analytics({ employees }: { employees: Employee[] }) {
  const active = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const stats = useMemo(() => {
    const withUan = active.filter((e) => e.uan).length;
    const withBank = active.filter((e) => e.bank_account_no && e.ifsc).length;
    const withDob = active.filter((e) => e.dob).length;

    // Median service length says more than a mean, which one long-serving
    // supervisor can drag upwards.
    const years = active
      .filter((e) => e.doj)
      .map((e) => (Date.now() - new Date(e.doj!).getTime()) / 31557600000)
      .sort((a, b) => a - b);
    const median = years.length
      ? years[Math.floor(years.length / 2)].toFixed(1)
      : "—";

    return { withUan, withBank, withDob, median };
  }, [active]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
        {[
          ["On roll", String(active.length)],
          ["Median service", `${stats.median} yr`],
          ["UAN on file", `${stats.withUan}/${active.length}`],
          ["Bank on file", `${stats.withBank}/${active.length}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-6 text-center">
            <p className="font-display text-2xl text-chalk">{value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-faint">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Bars title="By grade" data={tally(active.map((e) => e.category))} />
        <Bars title="By designation" data={tally(active.map((e) => e.designation))} />
        <Bars
          title="By status"
          data={tally(employees.map((e) => e.status))}
        />
        <Bars
          title="Joined by year"
          data={tally(active.map((e) => (e.doj ? e.doj.slice(0, 4) : null))).sort(
            (a, b) => a.label.localeCompare(b.label),
          )}
        />
      </div>

      {stats.withBank < active.length ? (
        <p className="mt-5 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[12px] text-accent-lit">
          {active.length - stats.withBank} active employee
          {active.length - stats.withBank === 1 ? "" : "s"} cannot be paid by
          bank transfer — account number or IFSC is missing.
        </p>
      ) : null}
    </div>
  );
}
