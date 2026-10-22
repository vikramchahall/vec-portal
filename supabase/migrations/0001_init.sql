-- =====================================================================
-- Vikram Engineering Co. -- initial schema
-- Phase 1 foundation: auth/roles/RLS, sites + rules, masters, employees.
-- Later-phase tables are created here too so there is ONE baseline
-- migration; features are added by app code, not by more DDL churn.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------
create type user_role          as enum ('admin','hr');
create type employee_status    as enum ('active','left','transferred');
create type payroll_status     as enum ('draft','review','final');
create type payroll_source     as enum ('computed','import');
create type attendance_source  as enum ('manual','quick','import');
create type wo_status          as enum ('active','completed','expired');
create type tender_status      as enum ('identified','preparing','submitted','won','lost','dropped');
create type invoice_status     as enum ('draft','sent','paid','partial');
create type billing_mode       as enum ('service_charge_pct','per_category_day_rate','fixed_monthly');
create type enquiry_type       as enum ('enquiry','tender_invite','vendor_registration');
create type application_status as enum ('new','shortlisted','rejected','hired');
create type document_type      as enum ('aadhaar','bank','photo','medical','gate_pass',
                                        'police_verification','safety_training','pf_nomination','other');
create type expense_head       as enum ('rent','transport','consumables','mess','insurance','licence','other');
create type rounding_mode      as enum ('roundup','round','none');
-- Which figure the OT / HP day-rate is built from.
create type wage_base          as enum ('full_gross','basic_da','basic_only');
-- Which figure PF is charged on.
create type pf_base_kind       as enum ('gross_minus_hra','basic_da');

-- ---------------------------------------------------------------------
-- 1. Profiles and access helpers
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null,
  role        user_role not null default 'hr',
  -- NULL = every site. Non-null = only these sites.
  site_ids    uuid[],
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- SECURITY DEFINER so the policies below can read profiles without
-- recursing into the profiles table's own RLS.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from profiles p
                 where p.id = auth.uid() and p.role = 'admin' and p.is_active);
$fn$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.is_active);
$fn$;

create or replace function can_access_site(target uuid) returns boolean
  language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.is_active
      and (p.role = 'admin' or p.site_ids is null or target = any(p.site_ids))
  );
$fn$;

-- ---------------------------------------------------------------------
-- 2. Masters
-- ---------------------------------------------------------------------
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,   -- UNSKILLED / SEMI-SKILLED / SKILLED / HIGHLY SKILLED / STAFF / WORKER
  sort  smallint not null default 0
);

create table designations (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,   -- HELPER / FITTER / CHEMIST / ...
  sort  smallint not null default 0
);

create table minimum_wages (
  id             uuid primary key default gen_random_uuid(),
  state          text not null,          -- Punjab / Rajasthan
  category_id    uuid not null references categories on delete restrict,
  effective_from date not null,
  basic          numeric(12,2) not null default 0,
  da             numeric(12,2) not null default 0,
  total          numeric(12,2) generated always as (basic + da) stored,
  note           text,
  unique (state, category_id, effective_from)
);
create index on minimum_wages (state, category_id, effective_from desc);

-- ---------------------------------------------------------------------
-- 3. Work orders, then sites (sites.work_order_id references work_orders)
-- ---------------------------------------------------------------------
create table work_orders (
  id                uuid primary key default gen_random_uuid(),
  client_name       text not null,
  wo_number         text,
  wo_date           date,
  title             text not null,
  scope             text,
  vendor_code       text,        -- HMEL 1900005225, HZL 004942, Triveni 105302
  value             numeric(14,2),
  start_date        date,
  end_date          date,
  extension_until   date,
  security_deposit  numeric(14,2),
  bg_expiry         date,
  dlp_months        smallint,
  payment_terms     text,
  file_path         text,        -- storage key, optional scan
  status            wo_status not null default 'active',
  created_at        timestamptz not null default now()
);
create index on work_orders (status, end_date);
create index on work_orders (bg_expiry);

create table sites (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,   -- ETP-HMEL, HZL-DEBARI
  name                text not null,
  client_name         text not null,
  principal_employer  text,
  plant_area          text,
  address             text,
  state               text not null,          -- drives minimum wage and LWF
  work_order_id       uuid references work_orders on delete set null,
  -- printed at the top of the working-salary sheet and the slips
  header_line_1       text,
  header_line_2       text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create index on sites (is_active);

-- ---------------------------------------------------------------------
-- 4. Site rules -- one row per rule VERSION, selected by effective_from.
--    Every default here was read off the company's own Excel formulas.
-- ---------------------------------------------------------------------
create table site_rules (
  id                        uuid primary key default gen_random_uuid(),
  site_id                   uuid not null references sites on delete cascade,
  effective_from            date not null,

  -- pro-rating: component * payable_days / prorate_days
  prorate_days_basis        text not null default 'calendar'
                            check (prorate_days_basis in ('calendar','fixed')),
  prorate_days_fixed        smallint,

  -- overtime and holiday-present
  ot_divisor                numeric(5,2) not null default 26,
  ot_hours_per_day          numeric(5,2) not null default 8,
  ot_base                   wage_base not null default 'full_gross',
  ot_multiplier             numeric(5,2) not null default 2,
  hp_base                   wage_base not null default 'full_gross',
  hp_multiplier             numeric(5,2) not null default 1,
  night_shift_rate          numeric(10,2) not null default 0,   -- HZL 50/night, ETP 0

  -- provident fund
  pf_enabled                boolean not null default true,
  pf_base                   pf_base_kind not null default 'gross_minus_hra',
  pf_ceiling                numeric(12,2),                      -- ETP 15000, HZL null
  pf_employee_pct           numeric(6,3) not null default 12,
  pf_employer_pct           numeric(6,3) not null default 13,
  pf_rounding               rounding_mode not null default 'roundup',

  -- ESI
  esi_enabled               boolean not null default true,
  esi_employee_pct          numeric(6,3) not null default 0.75,
  esi_employer_pct          numeric(6,3) not null default 3.25,
  esi_wage_ceiling          numeric(12,2) not null default 21000,
  esi_rounding              rounding_mode not null default 'roundup',

  -- other statutory
  lwf_enabled               boolean not null default false,
  lwf_employee              numeric(10,2) not null default 0,   -- Punjab 5
  lwf_employer              numeric(10,2) not null default 0,   -- Punjab 20
  benevolent_fund           numeric(10,2) not null default 0,   -- HZL 100
  professional_tax          numeric(10,2) not null default 0,   -- kept, 0 in PB and RJ

  -- bonus
  bonus_pct                 numeric(6,4) not null default 8.33,
  pay_bonus_monthly         boolean not null default false,
  bonus_rounding            rounding_mode not null default 'roundup',

  -- minimum wage handling
  da_split_pct              numeric(5,2),   -- ETP: DA = 25% of MW total; HZL: null (entered)

  -- leave accrual
  cl_accrual_per_month      numeric(6,3) not null default 0.25,
  el_accrual_per_month      numeric(6,3) not null default 0.896,
  el_accrual_per_day        numeric(6,4) not null default 0.064,  -- x (P + HP) days

  -- presentation and misc
  default_rounding          rounding_mode not null default 'roundup',
  deduct_hold_from_net      boolean not null default true,
  slip_hide_zero_rows       boolean not null default false,
  -- which salary components this site actually uses, in display order
  visible_components        text[] not null
                            default '{basic,da,hra,conveyance,education,medical,other}',
  note                      text,
  created_at                timestamptz not null default now(),
  unique (site_id, effective_from)
);
create index on site_rules (site_id, effective_from desc);

-- ---------------------------------------------------------------------
-- 5. Employees and salary structures
-- ---------------------------------------------------------------------
create table employees (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites on delete restrict,
  emp_code         text not null,   -- ZSD0026611 (HZL) or register no 46862524 (ETP)
  sl_no            integer,         -- serial on the client's sheet; drives slip order
  full_name        text not null,
  father_name      text,
  gender           text check (gender is null or gender in ('M','F','O')),
  dob              date,
  doj              date,
  dol              date,
  designation_id   uuid references designations on delete set null,
  category_id      uuid references categories on delete set null,
  plant_area       text,
  esi_number       text,
  uan              text,
  pf_account_no    text,
  pf_applicable    boolean not null default true,
  esi_applicable   boolean not null default true,
  bank_name        text,
  bank_account_no  text,
  ifsc             text,
  aadhaar_last4    text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  mobile           text,
  photo_path       text,
  status           employee_status not null default 'active',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (site_id, emp_code)
);
create index on employees (site_id, status);
create index on employees (site_id, sl_no);
create index on employees (designation_id);
create index on employees (category_id);

create table salary_structures (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references employees on delete cascade,
  effective_from    date not null,
  basic             numeric(12,2) not null default 0,
  da                numeric(12,2) not null default 0,
  hra               numeric(12,2) not null default 0,
  conveyance        numeric(12,2) not null default 0,
  education         numeric(12,2) not null default 0,
  medical           numeric(12,2) not null default 0,
  special_allowance numeric(12,2) not null default 0,
  other_allowance   numeric(12,2) not null default 0,
  night_shift_rate  numeric(10,2),     -- null = inherit site rule
  -- Per-employee override of the site's OT base. The HZL July-2026 sheet
  -- computes most rows on (basic+da) but ZSD0026616 on full gross; this
  -- column reproduces that row without corrupting the site-wide rule.
  ot_base_override  wage_base,
  note              text,
  created_at        timestamptz not null default now(),
  unique (employee_id, effective_from)
);
create index on salary_structures (employee_id, effective_from desc);

-- ---------------------------------------------------------------------
-- 6. Attendance -- ONE row per employee per month. Never one row per day.
-- ---------------------------------------------------------------------
create table attendance_months (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites on delete cascade,
  employee_id    uuid not null references employees on delete cascade,
  month          date not null,      -- always the 1st
  days_in_month  smallint not null,
  -- one char per day: P W H Q O L C X   (dash = day outside the month)
  day_codes      text not null default '',
  ot_hours       numeric(5,2)[] not null default '{}',
  extra_hours    numeric(5,2)[] not null default '{}',   -- C-Off sheet, may be negative
  night_shifts   smallint not null default 0,
  remarks        text,
  source         attendance_source not null default 'manual',
  updated_by     uuid references auth.users on delete set null,
  updated_at     timestamptz not null default now(),
  unique (employee_id, month),
  constraint day_codes_valid check (day_codes ~ '^[PWHQOLCX-]*$' and length(day_codes) <= 31)
);
create index on attendance_months (site_id, month);

create table ot_justifications (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites on delete cascade,
  employee_id      uuid not null references employees on delete cascade,
  month            date not null,
  work_date        date not null,
  work_description text not null,
  ot_hours         numeric(5,2) not null,
  reason           text,
  created_at       timestamptz not null default now()
);
create index on ot_justifications (site_id, month);
create index on ot_justifications (employee_id, month);

create table leave_balances (
  employee_id   uuid not null references employees on delete cascade,
  as_of_month   date not null,
  cl_balance    numeric(6,2) not null default 0,
  el_balance    numeric(6,2) not null default 0,
  coff_balance  numeric(6,2) not null default 0,
  primary key (employee_id, as_of_month)
);

-- ---------------------------------------------------------------------
-- 7. Payroll
-- ---------------------------------------------------------------------
create table payroll_runs (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites on delete cascade,
  month          date not null,
  version        smallint not null default 1,
  status         payroll_status not null default 'draft',
  days_in_month  smallint not null,
  ot_divisor     numeric(5,2) not null,
  rule_snapshot  jsonb not null,     -- frozen copy of site_rules used
  created_by     uuid references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  finalized_by   uuid references auth.users on delete set null,
  finalized_at   timestamptz,
  unique (site_id, month, version)
);
create index on payroll_runs (site_id, month);

create table payroll_lines (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid not null references payroll_runs on delete cascade,
  employee_id           uuid not null references employees on delete restrict,
  source                payroll_source not null default 'computed',

  -- identity frozen at run time (people leave; old slips must still print)
  sl_no                 integer,
  emp_code              text not null,
  full_name             text not null,
  designation           text,
  category              text,
  doj                   date,

  -- minimum wage reference
  mw_basic              numeric(12,2) not null default 0,
  mw_da                 numeric(12,2) not null default 0,

  -- attendance
  payable_days          numeric(5,2) not null default 0,
  lop_days              numeric(5,2) not null default 0,
  present_days          numeric(5,2) not null default 0,
  hp_days               numeric(5,2) not null default 0,
  ot_days               numeric(6,3) not null default 0,
  night_shifts          smallint not null default 0,

  -- full (un-prorated) structure
  full_basic            numeric(12,2) not null default 0,
  full_da               numeric(12,2) not null default 0,
  full_hra              numeric(12,2) not null default 0,
  full_conveyance       numeric(12,2) not null default 0,
  full_education        numeric(12,2) not null default 0,
  full_medical          numeric(12,2) not null default 0,
  full_special          numeric(12,2) not null default 0,
  full_other            numeric(12,2) not null default 0,
  full_gross            numeric(12,2) not null default 0,

  -- earned (pro-rated) components
  basic_e               numeric(12,2) not null default 0,
  da_e                  numeric(12,2) not null default 0,
  hra_e                 numeric(12,2) not null default 0,
  conveyance_e          numeric(12,2) not null default 0,
  education_e           numeric(12,2) not null default 0,
  medical_e             numeric(12,2) not null default 0,
  special_e             numeric(12,2) not null default 0,
  other_e               numeric(12,2) not null default 0,
  gross_earned          numeric(12,2) not null default 0,

  ot_amount             numeric(12,2) not null default 0,
  hp_amount             numeric(12,2) not null default 0,
  night_amount          numeric(12,2) not null default 0,
  total_earning         numeric(12,2) not null default 0,

  -- employee deductions
  pf_employee           numeric(12,2) not null default 0,
  esi_employee          numeric(12,2) not null default 0,
  lwf_employee          numeric(12,2) not null default 0,
  benevolent_fund       numeric(12,2) not null default 0,
  professional_tax      numeric(12,2) not null default 0,
  other_deduction_1     numeric(12,2) not null default 0,
  other_deduction_2     numeric(12,2) not null default 0,
  other_deduction_3     numeric(12,2) not null default 0,
  mess_bill             numeric(12,2) not null default 0,
  advance_recovery      numeric(12,2) not null default 0,
  total_deductions      numeric(12,2) not null default 0,

  -- employer cost
  pf_employer           numeric(12,2) not null default 0,
  esi_employer          numeric(12,2) not null default 0,
  lwf_employer          numeric(12,2) not null default 0,

  monthly_bonus         numeric(12,2) not null default 0,
  annual_bonus_accrual  numeric(12,2) not null default 0,
  leave_encashment      numeric(12,2) not null default 0,
  hold_amount           numeric(12,2) not null default 0,

  net_salary            numeric(12,2) not null default 0,
  ctc                   numeric(12,2) not null default 0,
  ctc_for_billing       numeric(12,2) not null default 0,

  -- "General salary": the same person at full attendance with zero OT
  general_gross         numeric(12,2) not null default 0,
  general_net           numeric(12,2) not null default 0,
  general_ctc           numeric(12,2) not null default 0,

  warnings              text[] not null default '{}',
  remarks               text,
  unique (run_id, employee_id)
);
create index on payroll_lines (employee_id);
create index on payroll_lines (run_id);

-- ---------------------------------------------------------------------
-- 8. Billing (admin only)
-- ---------------------------------------------------------------------
create table billing_rates (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references sites on delete cascade,
  effective_from      date not null,
  mode                billing_mode not null,
  service_charge_pct  numeric(6,3),
  gst_pct             numeric(6,3) not null default 18,
  rates               jsonb not null default '{}',   -- category_id -> rate per day
  fixed_monthly       numeric(14,2),
  unique (site_id, effective_from)
);

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites on delete cascade,
  month          date not null,
  run_id         uuid references payroll_runs on delete set null,
  invoice_no     text unique,          -- VEC/2026-27/001
  invoice_date   date,
  basis_amount   numeric(14,2) not null default 0,
  service_charge numeric(14,2) not null default 0,
  gst            numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  status         invoice_status not null default 'draft',
  paid_amount    numeric(14,2) not null default 0,
  paid_on        date,
  notes          text,
  created_at     timestamptz not null default now()
);
create index on invoices (site_id, month);
create index on invoices (status, invoice_date);

create table site_expenses (
  id       uuid primary key default gen_random_uuid(),
  site_id  uuid not null references sites on delete cascade,
  month    date not null,
  head     expense_head not null,
  amount   numeric(14,2) not null,
  note     text
);
create index on site_expenses (site_id, month);

-- ---------------------------------------------------------------------
-- 9. Documents, public site, tenders, audit
-- ---------------------------------------------------------------------
create table employee_documents (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees on delete cascade,
  type         document_type not null,
  file_path    text not null,
  size_bytes   integer,
  expires_on   date,
  uploaded_at  timestamptz not null default now()
);
create index on employee_documents (employee_id);
create index on employee_documents (expires_on);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  client       text not null,
  title        text not null,
  location     text,
  city         text,
  state        text,
  period_text  text,
  -- Held for internal reference only; the public site never renders it.
  value_text   text,
  description  text,
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  sort_order   smallint not null default 0,
  logo_path    text
);

create table openings (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid references sites on delete set null,
  category_id uuid references categories on delete set null,
  title       text not null,
  city        text,
  description text,
  vacancies   smallint,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table tenders (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  tender_id       text,
  title           text not null,
  organisation    text,
  location        text,
  emd             numeric(14,2),
  estimated_value numeric(14,2),
  published_on    date,
  due_on          date,
  status          tender_status not null default 'identified',
  assigned_to     uuid references auth.users on delete set null,
  notes           text,
  url             text,
  created_at      timestamptz not null default now()
);
create index on tenders (status, due_on);

create table enquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  company    text,
  message    text,
  type       enquiry_type not null default 'enquiry',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
create index on enquiries (handled, created_at desc);

create table job_applications (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text,
  email            text,
  city             text,
  position_applied text,
  category_id      uuid references categories on delete set null,
  experience_years numeric(4,1),
  resume_path      text,
  message          text,
  status           application_status not null default 'new',
  created_at       timestamptz not null default now()
);
create index on job_applications (status, created_at desc);

-- Company-wide settings shown on the public About page (GST, EPF, ESIC,
-- labour licence numbers). Rendered only when non-empty.
create table app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references auth.users on delete set null,
  action     text not null,
  table_name text not null,
  row_id     text,
  diff       jsonb,
  at         timestamptz not null default now()
);
create index on audit_log (table_name, at desc);
create index on audit_log (actor_id, at desc);
