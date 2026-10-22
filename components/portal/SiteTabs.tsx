"use client";

import { useState, type ReactNode } from "react";

const TABS = ["Employees", "Working salary", "Analytics"] as const;
type Tab = (typeof TABS)[number];

export default function SiteTabs({
  employees,
  workingSalary,
  analytics,
}: {
  employees: ReactNode;
  workingSalary: ReactNode;
  analytics: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("Employees");

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors duration-300 ${
                on ? "text-chalk" : "text-faint hover:text-mist"
              }`}
            >
              {t}
              <span
                className={`absolute inset-x-0 bottom-[-1px] h-0.5 bg-accent transition-transform duration-300 ${
                  on ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {tab === "Employees" ? employees : null}
        {tab === "Working salary" ? workingSalary : null}
        {tab === "Analytics" ? analytics : null}
      </div>
    </div>
  );
}
