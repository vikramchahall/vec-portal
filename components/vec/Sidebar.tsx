"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

type Item = { t: string; href?: string; soon?: string };
type Group = { t: string; icon: string; items: Item[] };
type Section = { label: string; single?: Item & { icon: string }; groups?: Group[] };

// Same groups as the WF-01 wireframes. Items without href are later build steps.
const NAV: Section[] = [
  { label: "Overview", single: { t: "Dashboard", href: "/portal", icon: "dashboard" } },
  { label: "Workforce", groups: [
    { t: "People", icon: "users", items: [
      { t: "Employee Directory", href: "/portal/employees" },
      { t: "Add Employee", href: "/portal/employees/new" },
      { t: "Import from Excel", href: "/portal/employees/import" },
      { t: "Employee Documents", soon: "S1b" },
    ] },
    { t: "Attendance", icon: "calendar", items: [
      { t: "Punch Data Upload", href: "/portal/attendance/upload" }, { t: "Time Compliance", href: "/portal/attendance/time-compliance" }, { t: "Attendance Review", href: "/portal/attendance/review" },
      { t: "Leave Management", soon: "S3" }, { t: "C-Off Management", soon: "S3" },
    ] },
  ] },
  { label: "Payroll & Compliance", groups: [
    { t: "Payroll", icon: "wallet", items: [
      { t: "Working Salary", href: "/portal/payroll/working-salary" }, { t: "Approval & Lock", href: "/portal/payroll/approval" },
    ] },
    { t: "Statutory & Compliance", icon: "shield", items: [
      { t: "PF / ESIC Challans", soon: "S7" }, { t: "Compliance Calendar", soon: "S7" },
    ] },
  ] },
  { label: "Business", groups: [
    { t: "Operations", icon: "factory", items: [{ t: "Sites & Units", href: "/portal/sites" }] },
    { t: "Finance", icon: "rupee", items: [{ t: "Billing & Profitability", soon: "P2" }] },
    { t: "Reports & Analytics", icon: "chart", items: [{ t: "Reports", soon: "S9" }] },
  ] },
];

export default function Sidebar() {
  const path = usePathname();
  const isActive = (href?: string) => !!href && (href === "/portal" ? path === "/portal" : path === href || (href === "/portal/employees" && /^\/portal\/employees\/\d+/.test(path)));
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (g: string) => setClosed((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <nav className="sidebar">
      {NAV.map((sec) => (
        <div key={sec.label}>
          <div className="nav-label">{sec.label}</div>
          {sec.single && (
            <Link className={`nav-item ${isActive(sec.single.href) ? "active" : ""}`} href={sec.single.href!} title={sec.single.t}>
              <Icon name={sec.single.icon} /><span>{sec.single.t}</span>
            </Link>
          )}
          {sec.groups?.map((g) => {
            const hasActive = g.items.some((i) => isActive(i.href));
            const open = hasActive || (!closed.has(g.t) && g.items.some((i) => i.href));
            return (
              <details key={g.t} className="nav-group" open={open} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open !== open) toggle(g.t); }}>
                <summary title={g.t}><Icon name={g.icon} /><span>{g.t}</span><Icon name="chevR" size="sm" className="chev" /></summary>
                <div className="nav-sub">
                  {g.items.map((i) => i.href
                    ? <Link key={i.t} href={i.href} className={isActive(i.href) ? "active" : ""}>{i.t}</Link>
                    : <span key={i.t} className="soon">{i.t}<i>{i.soon}</i></span>)}
                </div>
              </details>
            );
          })}
        </div>
      ))}
      <div className="sidebar-foot">
        <form action="/logout" method="post">
          <button className="nav-item" style={{ width: "100%", background: "none", border: 0 }} type="submit"><Icon name="logout" /><span>Sign out</span></button>
        </form>
      </div>
    </nav>
  );
}
