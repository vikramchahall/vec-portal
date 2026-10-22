-- =====================================================================
-- Vikram Engineering Co. — PHASE 2 (part 3): wages, attendance, payroll
-- Run AFTER 04-sites-employees.sql. Safe to re-run.
--
--   minimum_wages       per site + category, versioned by effective_from
--   salary_structures   per employee, versioned; overrides the category
--   attendance_months   ONE row per employee per month (not 31 rows)
--   site_payroll_rules  the knobs that differ between HMEL and HZL
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Minimum wages — the fallback when an employee has no structure
-- ---------------------------------------------------------------------
create table if not exists minimum_wages (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites on delete cascade,
  category       skill_grade not null,
  effective_from date not null,
  basic          numeric(12,2) not null default 0,
  da             numeric(12,2) not null default 0,
  hra            numeric(12,2) not null default 0,
  conveyance     numeric(12,2) not null default 0,
  education      numeric(12,2) not null default 0,
  medical        numeric(12,2) not null default 0,
  other          numeric(12,2) not null default 0,
  -- HMEL ETP's "Special Allowance" column. Zero at HZL.
  special        numeric(12,2) not null default 0,
  night_rate     numeric(10,2) not null default 0,
  benevolent     numeric(10,2) not null default 0,
  ot_base        text not null default 'mw' check (ot_base in ('mw', 'gross')),
  created_at     timestamptz not null default now(),
  unique (site_id, category, effective_from)
);

create index if not exists minimum_wages_lookup_idx
  on minimum_wages (site_id, category, effective_from desc);

-- ---------------------------------------------------------------------
-- 2. Salary structures — per employee, versioned
--
-- History is kept: payroll always picks the row effective on the 1st of
-- the month being run, so re-printing an old month stays correct after
-- a revision.
-- ---------------------------------------------------------------------
create table if not exists salary_structures (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees on delete cascade,
  effective_from date not null,

  basic          numeric(12,2) not null default 0,
  da             numeric(12,2) not null default 0,
  hra            numeric(12,2) not null default 0,
  conveyance     numeric(12,2) not null default 0,
  education      numeric(12,2) not null default 0,
  medical        numeric(12,2) not null default 0,
  other          numeric(12,2) not null default 0,
  special        numeric(12,2) not null default 0,

  -- Rs per night present. HZL pays 50; HMEL pays nothing.
  night_rate     numeric(10,2) not null default 0,
  -- HZL deducts a Rs 100 benevolent fund from workers, not from staff.
  benevolent     numeric(10,2) not null default 0,

  -- 'mw'    -> overtime is paid on (minimum wage basic + DA)
  -- 'gross' -> overtime is paid on the full gross
  -- Verified against the July-2026 HZL sheet: people with a DA use 'mw',
  -- people on a negotiated CTC with no DA use 'gross'.
  ot_base        text not null default 'mw' check (ot_base in ('mw', 'gross')),

  plant_area     text,
  created_at     timestamptz not null default now(),
  unique (employee_id, effective_from)
);

create index if not exists salary_structures_lookup_idx
  on salary_structures (employee_id, effective_from desc);

-- ---------------------------------------------------------------------
-- 3. Attendance — ONE row per employee per month
--
-- 160 employees x 12 months is ~2,000 rows a year, not 60,000.
-- ---------------------------------------------------------------------
create table if not exists attendance_months (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites on delete cascade,
  employee_id   uuid not null references employees on delete cascade,
  month         date not null,                       -- always the 1st
  days_in_month smallint not null,
  days_worked   numeric(5,2) not null default 0,
  lop           numeric(5,2) not null default 0,
  ot_days       numeric(6,3) not null default 0,     -- OT hours / 8
  ph_ot_days    numeric(6,3) not null default 0,     -- holiday overtime
  night_presents smallint not null default 0,
  hold_amount   numeric(12,2) not null default 0,
  remarks       text,
  updated_by    uuid references auth.users on delete set null,
  updated_at    timestamptz not null default now(),
  unique (employee_id, month)
);

create index if not exists attendance_month_idx
  on attendance_months (site_id, month);

drop trigger if exists attendance_touch on attendance_months;
create trigger attendance_touch
  before update on attendance_months
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Per-site payroll rules
-- ---------------------------------------------------------------------
create table if not exists site_payroll_rules (
  site_id          uuid primary key references sites on delete cascade,
  ot_divisor       smallint not null default 26,
  ot_multiplier    numeric(4,2) not null default 2,
  ph_ot_multiplier numeric(4,2) not null default 2,
  night_rate       numeric(10,2) not null default 0,
  benevolent       numeric(10,2) not null default 0,
  pf_employee_pct  numeric(5,2) not null default 12,
  pf_employer_pct  numeric(5,2) not null default 13,
  esi_employee_pct numeric(5,2) not null default 0.75,
  esi_employer_pct numeric(5,2) not null default 3.25,
  esi_gross_limit  numeric(12,2) not null default 21000,
  -- 'basic_da'        -> 12% of earned basic + DA        (HZL Debari)
  -- 'gross_minus_hra' -> 12% of earned gross less HRA    (HMEL ETP)
  -- Verified 40/40 against the ETP August-2026 sheet.
  pf_base          text not null default 'basic_da'
                   check (pf_base in ('basic_da', 'gross_minus_hra')),
  -- ETP charges ESI on total earning PLUS the monthly bonus.
  esi_includes_bonus boolean not null default false,
  -- Which Working Salary layout this site's export must reproduce.
  sheet_template   text not null default 'hzl'
                   check (sheet_template in ('hzl', 'etp')),
  -- 12% of a capped base, the way EPFO allows. HZL applies no ceiling.
  pf_wage_ceiling  numeric(12,2),
  wf_employee      numeric(10,2) not null default 0,
  wf_employer      numeric(10,2) not null default 0,
  bonus_monthly    boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. RLS — same site-scoping as everything else
-- ---------------------------------------------------------------------
alter table minimum_wages      enable row level security;
alter table salary_structures  enable row level security;
alter table attendance_months  enable row level security;
alter table site_payroll_rules enable row level security;

do $$
declare t text;
begin
  foreach t in array array['minimum_wages', 'attendance_months'] loop
    execute format('drop policy if exists "staff read %1$s" on %1$s', t);
    execute format($p$create policy "staff read %1$s" on %1$s
      for select to authenticated using (public.can_access_site(site_id))$p$, t);

    execute format('drop policy if exists "staff write %1$s" on %1$s', t);
    execute format($p$create policy "staff write %1$s" on %1$s
      for all to authenticated
      using (public.can_access_site(site_id))
      with check (public.can_access_site(site_id))$p$, t);
  end loop;
end $$;

drop policy if exists "staff read structures" on salary_structures;
create policy "staff read structures"
  on salary_structures for select to authenticated
  using (exists (select 1 from employees e
                 where e.id = employee_id and public.can_access_site(e.site_id)));

drop policy if exists "staff write structures" on salary_structures;
create policy "staff write structures"
  on salary_structures for all to authenticated
  using (exists (select 1 from employees e
                 where e.id = employee_id and public.can_access_site(e.site_id)))
  with check (exists (select 1 from employees e
                      where e.id = employee_id and public.can_access_site(e.site_id)));

drop policy if exists "staff read rules" on site_payroll_rules;
create policy "staff read rules"
  on site_payroll_rules for select to authenticated
  using (public.can_access_site(site_id));

drop policy if exists "staff write rules" on site_payroll_rules;
create policy "staff write rules"
  on site_payroll_rules for all to authenticated
  using (public.can_access_site(site_id))
  with check (public.can_access_site(site_id));

-- ---------------------------------------------------------------------
-- 6. Seed the rules for the four live sites
-- ---------------------------------------------------------------------
insert into site_payroll_rules (
  site_id, night_rate, benevolent, wf_employee, wf_employer,
  ph_ot_multiplier, pf_base, pf_wage_ceiling, esi_includes_bonus,
  bonus_monthly, sheet_template)
select
  id,
  case when code = 'HZL-DEBARI' then 50 else 0 end,
  case when code = 'HZL-DEBARI' then 100 else 0 end,
  case when code = 'HZL-DEBARI' then 0 else 5 end,
  case when code = 'HZL-DEBARI' then 0 else 20 end,
  -- HZL pays holiday work at 2x; HMEL pays 1x.
  case when code = 'HZL-DEBARI' then 2 else 1 end,
  case when code = 'HZL-DEBARI' then 'basic_da' else 'gross_minus_hra' end,
  -- HZL applies no EPFO ceiling; HMEL caps the PF wage at 15,000.
  case when code = 'HZL-DEBARI' then null else 15000 end,
  case when code = 'HZL-DEBARI' then false else true end,
  case when code = 'HZL-DEBARI' then false else true end,
  case when code = 'HZL-DEBARI' then 'hzl' else 'etp' end
from sites
on conflict (site_id) do update set
  night_rate         = excluded.night_rate,
  benevolent         = excluded.benevolent,
  wf_employee        = excluded.wf_employee,
  wf_employer        = excluded.wf_employer,
  ph_ot_multiplier   = excluded.ph_ot_multiplier,
  pf_base            = excluded.pf_base,
  pf_wage_ceiling    = excluded.pf_wage_ceiling,
  esi_includes_bonus = excluded.esi_includes_bonus,
  bonus_monthly      = excluded.bonus_monthly,
  sheet_template     = excluded.sheet_template;

-- =====================================================================
-- VERIFY
--   select s.code, r.ot_divisor, r.night_rate, r.benevolent
--   from site_payroll_rules r join sites s on s.id = r.site_id
--   order by s.code;
-- =====================================================================
