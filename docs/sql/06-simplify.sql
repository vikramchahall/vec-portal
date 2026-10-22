-- =====================================================================
-- Vikram Engineering Co. — PHASE 2 (part 4): make the month cheap to run
-- Run AFTER 05-payroll.sql. Safe to re-run.
--
-- Driven by what the real workbooks actually need each month. Measured on
-- ETP-HMEL January 2026 (59 people): 51 worked the full month, 9 had any
-- overtime, and only 8 had a days-payable figure other than 31. The whole
-- monthly input is ~50 numbers. Everything else is constant or derived.
--
-- This migration:
--   1. derives LOP instead of storing it (it is days_in_month - worked)
--   2. normalises the four spellings of "unskilled" in employees.category
--   3. adds the index the month-on-month comparison needs
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LOP is derived, not typed
--
-- One less number to enter, and it can never disagree with days_worked.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attendance_months' and column_name = 'lop'
      and is_generated = 'NEVER'
  ) then
    alter table attendance_months drop column lop;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'attendance_months' and column_name = 'lop'
  ) then
    alter table attendance_months
      add column lop numeric(5,2)
      generated always as (greatest(days_in_month - days_worked, 0)) stored;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tidy the skill grades
--
-- The ETP master sheet carries UNSKILLED, "Un Skilled", "Un skilled" and
-- "un skilled" as four distinct values. A dropdown stops new ones
-- appearing; this fixes the ones already stored.
-- ---------------------------------------------------------------------
create or replace function public.normalise_grade(raw text)
returns skill_grade
language sql
immutable
as $$
  select case
    when raw is null then null
    when regexp_replace(upper(raw), '[^A-Z]', '', 'g') in
         ('UNSKILLED', 'UNSKILED')                      then 'UNSKILLED'
    when regexp_replace(upper(raw), '[^A-Z]', '', 'g') in
         ('SEMISKILLED', 'SEMISKILED')                  then 'SEMI-SKILLED'
    when regexp_replace(upper(raw), '[^A-Z]', '', 'g') in
         ('HIGHSKILLED', 'HIGHLYSKILLED', 'HIGHSKILED') then 'HIGHLY SKILLED'
    when regexp_replace(upper(raw), '[^A-Z]', '', 'g') = 'SKILLED'  then 'SKILLED'
    when regexp_replace(upper(raw), '[^A-Z]', '', 'g') in
         ('STAFF', 'WORKER')                            then 'STAFF'
    else null
  end::skill_grade;
$$;

-- ---------------------------------------------------------------------
-- 3. Index for "what did this person earn last month"
-- ---------------------------------------------------------------------
create index if not exists attendance_prev_idx
  on attendance_months (employee_id, month desc);

-- ---------------------------------------------------------------------
-- 4. Snapshot of a finalised month
--
-- Once slips are printed the figures must stop moving, even if a wage
-- rate is revised afterwards. There is no draft/review/approve workflow —
-- you save as you go, and locking happens when slips are generated.
-- ---------------------------------------------------------------------
create table if not exists payroll_snapshots (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites on delete cascade,
  month       date not null,
  employee_id uuid not null references employees on delete cascade,
  -- The whole computed line, exactly as printed.
  line        jsonb not null,
  locked_at   timestamptz not null default now(),
  locked_by   uuid references auth.users on delete set null,
  unique (employee_id, month)
);

create index if not exists payroll_snapshots_month_idx
  on payroll_snapshots (site_id, month);

alter table payroll_snapshots enable row level security;

drop policy if exists "staff read snapshots" on payroll_snapshots;
create policy "staff read snapshots"
  on payroll_snapshots for select to authenticated
  using (public.can_access_site(site_id));

drop policy if exists "staff write snapshots" on payroll_snapshots;
create policy "staff write snapshots"
  on payroll_snapshots for all to authenticated
  using (public.can_access_site(site_id))
  with check (public.can_access_site(site_id));

-- =====================================================================
-- OPTIONAL — tables from phase 1 that nothing reads yet.
--
-- Left in place deliberately: dropping a table is irreversible and these
-- cost nothing empty. Run these only if you are sure.
--
--   drop table if exists site_images;
--   drop table if exists openings;
--   drop table if exists tenders;
--
-- `app_settings` IS used (the Compliance page reads it) — keep it.
-- =====================================================================
