import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Employee, EmployeeDocument } from "@/lib/types";
import { DEFAULT_RULES, type PayrollRules } from "@/lib/payroll";
import Shell from "@/components/portal/Shell";
import SiteTabs from "@/components/portal/SiteTabs";
import EmployeeList from "@/components/portal/EmployeeList";
import ImportExcel from "@/components/portal/ImportExcel";
import ExportEmployees from "@/components/portal/ExportEmployees";
import ImportStructures from "@/components/portal/ImportStructures";
import WorkingSalary, { type StructureRow } from "@/components/portal/WorkingSalary";
import type { WageRow } from "@/components/portal/MinimumWages";
import Analytics from "@/components/portal/Analytics";

export const metadata: Metadata = { title: "Site", robots: { index: false } };

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // RLS returns nothing for a site this user cannot reach, which is
  // indistinguishable from "does not exist" — and should be.
  if (!site) notFound();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("site_id", id)
    .order("status")
    .order("full_name");

  const list = (employees ?? []) as Employee[];
  const ids = list.map((e) => e.id);

  const { data: documents } = ids.length
    ? await supabase
        .from("employee_documents")
        .select("*")
        .in("employee_id", ids)
        .order("uploaded_at", { ascending: false })
    : { data: [] };

  // Month defaults to the one just finished — payroll is run in arrears.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = /^\d{4}-\d{2}$/.test(m ?? "")
    ? `${m}-01`
    : `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;

  // Salary structures: newest row effective on or before the 1st wins.
  const { data: structureRows } = ids.length
    ? await supabase
        .from("salary_structures")
        .select("*")
        .in("employee_id", ids)
        .lte("effective_from", month)
        .order("effective_from", { ascending: false })
    : { data: [] };

  const structures: StructureRow[] = [];
  const seen = new Set<string>();
  for (const r of structureRows ?? []) {
    if (seen.has(r.employee_id)) continue;
    seen.add(r.employee_id);
    structures.push({
      employee_id: r.employee_id,
      plant_area: r.plant_area,
      basic: Number(r.basic),
      da: Number(r.da),
      hra: Number(r.hra),
      conveyance: Number(r.conveyance),
      education: Number(r.education),
      medical: Number(r.medical),
      other: Number(r.other),
      special: Number(r.special ?? 0),
      nightRate: Number(r.night_rate),
      benevolent: Number(r.benevolent),
      otBase: r.ot_base === "gross" ? "gross" : "mw",
    });
  }

  // Minimum wages per grade: newest row effective on or before the 1st.
  const { data: wageRows } = await supabase
    .from("minimum_wages")
    .select("*")
    .eq("site_id", id)
    .lte("effective_from", month)
    .order("effective_from", { ascending: false });

  const wages: Record<string, WageRow> = {};
  for (const w of wageRows ?? []) {
    if (wages[w.category]) continue;      // newer row already taken
    wages[w.category] = {
      category: w.category,
      basic: Number(w.basic),
      da: Number(w.da),
      hra: Number(w.hra),
      conveyance: Number(w.conveyance),
      education: Number(w.education),
      medical: Number(w.medical),
      other: Number(w.other),
      special: Number(w.special ?? 0),
      nightRate: Number(w.night_rate),
      benevolent: Number(w.benevolent),
      otBase: w.ot_base === "gross" ? "gross" : "mw",
    };
  }

  const { data: attRows } = ids.length
    ? await supabase
        .from("attendance_months")
        .select("*")
        .eq("site_id", id)
        .eq("month", month)
    : { data: [] };

  const initialAttendance = Object.fromEntries(
    (attRows ?? []).map((a) => [
      a.employee_id,
      {
        daysWorked: Number(a.days_worked),
        otDays: Number(a.ot_days),
        phOtDays: Number(a.ph_ot_days),
        nightPresents: Number(a.night_presents),
        holdAmount: Number(a.hold_amount),
      },
    ]),
  );

  // Previous month's net per employee, for the "vs last" column. Read from
  // the locked snapshot so the comparison is against what was actually
  // printed, not against a recomputation under today's rates.
  const [py, pm] = month.split("-").map(Number);
  const prevDate = new Date(py, pm - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: prevRows } = ids.length
    ? await supabase
        .from("payroll_snapshots")
        .select("employee_id, line")
        .eq("site_id", id)
        .eq("month", prevMonth)
    : { data: [] };

  const previousNet: Record<string, number> = {};
  for (const r of prevRows ?? []) {
    const net = (r.line as { netSalary?: number } | null)?.netSalary;
    if (typeof net === "number") previousNet[r.employee_id] = net;
  }

  const { data: ruleRow } = await supabase
    .from("site_payroll_rules")
    .select("*")
    .eq("site_id", id)
    .maybeSingle();

  const rules: PayrollRules = ruleRow
    ? {
        otDivisor: Number(ruleRow.ot_divisor),
        otMultiplier: Number(ruleRow.ot_multiplier),
        phOtMultiplier: Number(ruleRow.ph_ot_multiplier),
        pfEmployeePct: Number(ruleRow.pf_employee_pct),
        pfEmployerPct: Number(ruleRow.pf_employer_pct),
        esiEmployeePct: Number(ruleRow.esi_employee_pct),
        esiEmployerPct: Number(ruleRow.esi_employer_pct),
        esiGrossLimit: Number(ruleRow.esi_gross_limit),
        pfBase: ruleRow.pf_base === "gross_minus_hra" ? "gross_minus_hra" : "basic_da",
        esiIncludesBonus: Boolean(ruleRow.esi_includes_bonus),
        pfWageCeiling:
          ruleRow.pf_wage_ceiling == null ? null : Number(ruleRow.pf_wage_ceiling),
        wfEmployee: Number(ruleRow.wf_employee),
        wfEmployer: Number(ruleRow.wf_employer),
        bonusMonthly: Boolean(ruleRow.bonus_monthly),
      }
    : DEFAULT_RULES;

  const active = list.filter((e) => e.status === "active").length;

  return (
    <Shell crumb={{ href: "/portal", label: "Sites" }}>
      <Link
        href="/portal"
        className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> All sites
      </Link>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {site.code}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-chalk">
          {site.name}
        </h1>
        <p className="mt-2 text-[13px] text-mist">
          {site.client_name}
          {site.principal_employer ? ` · via ${site.principal_employer}` : ""}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-faint">
          {[site.city, site.state].filter(Boolean).join(", ")}
          {` · ${active} active`}
        </p>
      </div>

      <div className="mt-10">
        <SiteTabs
          employees={
            <>
              <div className="flex flex-wrap items-center gap-3">
                <ImportExcel siteId={site.id} />
                <ExportEmployees employees={list} siteCode={site.code} />
              </div>
              <ImportStructures
                siteId={site.id}
                effectiveFrom={month}
                employees={list.map((e) => ({
                  id: e.id,
                  emp_code: e.emp_code,
                  full_name: e.full_name,
                }))}
              />
              <div className="mt-8">
                <EmployeeList
                  siteId={site.id}
                  employees={list}
                  documents={(documents ?? []) as EmployeeDocument[]}
                />
              </div>
            </>
          }
          workingSalary={
            <WorkingSalary
              site={site}
              employees={list}
              structures={structures}
              wages={wages}
              rules={rules}
              initialMonth={month}
              initialAttendance={initialAttendance}
              previousNet={previousNet}
            />
          }
          analytics={<Analytics employees={list} />}
        />
      </div>
    </Shell>
  );
}
