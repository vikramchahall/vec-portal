import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon, Mark } from "@/components/vec/Icon";
import Sidebar from "@/components/vec/Sidebar";
import { CollapseButton, ThemeButton } from "@/components/vec/TopbarControls";

export const dynamic = "force-dynamic";

function payrollMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1); // salaries are made for the month just ended
  const fy = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return { month: d.toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "-"), fy: `FY ${fy}-${String(fy + 1).slice(2)}` };
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const p = payrollMonth();
  const initials = user.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/portal" style={{ color: "#fff" }}>
          <Mark light />
          <div><b>VEC Portal</b><span>Vikram Engineering Co.</span></div>
        </Link>
        <CollapseButton />
        <form className="top-search" action="/portal/employees">
          <Icon name="search" size="sm" />
          <input name="q" placeholder="Search employees, card no., UAN, mobile…" aria-label="Search employees" />
        </form>
        <div className="top-right">
          <div className="period"><Icon name="calendar" size="sm" /><span className="full">{p.fy} ·</span> Payroll <b>{p.month}</b></div>
          <ThemeButton />
          <div className="user">
            <div className="avatar">{initials}</div>
            <div><b>{user.name}</b><small>{user.role === "owner" ? "Owner · Admin" : "HR"}</small></div>
          </div>
        </div>
      </header>
      <Sidebar />
      <main className="main"><div className="page">{children}</div></main>
    </div>
  );
}
