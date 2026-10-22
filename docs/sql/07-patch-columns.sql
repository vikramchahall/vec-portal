-- =====================================================================
-- PATCH: add columns that 05-payroll.sql gained after you first ran it
--
-- Why this is needed
-- ------------------
-- 05 creates its tables with `create table if not exists`. When I added
-- the `special` allowance and the ETP rule columns to that file, re-running
-- it did nothing for you — the tables already existed, so the new columns
-- were silently skipped. Hence:
--
--     Could not find the 'special' column of 'salary_structures'
--
-- This migration uses ALTER, which works on an existing table. Run it
-- once. Safe to re-run, and safe even if 05 was never run at all.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `special` allowance — HMEL ETP's "Special Allowance" column
-- ---------------------------------------------------------------------
alter table if exists salary_structures
  add column if not exists special numeric(12,2) not null default 0;

alter table if exists minimum_wages
  add column if not exists special numeric(12,2) not null default 0;

-- Older copies of 05 also lacked the rest of the allowance set on
-- minimum_wages. Add anything missing.
alter table if exists minimum_wages
  add column if not exists hra        numeric(12,2) not null default 0,
  add column if not exists conveyance numeric(12,2) not null default 0,
  add column if not exists education  numeric(12,2) not null default 0,
  add column if not exists medical    numeric(12,2) not null default 0,
  add column if not exists other      numeric(12,2) not null default 0,
  add column if not exists night_rate numeric(10,2) not null default 0,
  add column if not exists benevolent numeric(10,2) not null default 0,
  add column if not exists ot_base    text not null default 'mw';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'minimum_wages_ot_base_check'
  ) then
    alter table minimum_wages
      add constraint minimum_wages_ot_base_check
      check (ot_base in ('mw', 'gross'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Per-site rule columns that separate HMEL ETP from HZL Debari
-- ---------------------------------------------------------------------
alter table if exists site_payroll_rules
  add column if not exists pf_base            text not null default 'basic_da',
  add column if not exists esi_includes_bonus boolean not null default false,
  add column if not exists sheet_template     text not null default 'hzl';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_payroll_rules_pf_base_check'
  ) then
    alter table site_payroll_rules
      add constraint site_payroll_rules_pf_base_check
      check (pf_base in ('basic_da', 'gross_minus_hra'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_payroll_rules_template_check'
  ) then
    alter table site_payroll_rules
      add constraint site_payroll_rules_template_check
      check (sheet_template in ('hzl', 'etp'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Re-seed the real per-site rules now the columns exist
-- ---------------------------------------------------------------------
update site_payroll_rules r
set night_rate         = case when s.code = 'HZL-DEBARI' then 50 else 0 end,
    benevolent         = case when s.code = 'HZL-DEBARI' then 100 else 0 end,
    wf_employee        = case when s.code = 'HZL-DEBARI' then 0 else 5 end,
    wf_employer        = case when s.code = 'HZL-DEBARI' then 0 else 20 end,
    ph_ot_multiplier   = case when s.code = 'HZL-DEBARI' then 2 else 1 end,
    pf_base            = case when s.code = 'HZL-DEBARI' then 'basic_da'
                              else 'gross_minus_hra' end,
    pf_wage_ceiling    = case when s.code = 'HZL-DEBARI' then null else 15000 end,
    esi_includes_bonus = (s.code <> 'HZL-DEBARI'),
    bonus_monthly      = (s.code <> 'HZL-DEBARI'),
    sheet_template     = case when s.code = 'HZL-DEBARI' then 'hzl' else 'etp' end
from sites s
where s.id = r.site_id;

-- Any site that has no rules row yet gets one.
insert into site_payroll_rules (site_id)
select id from sites
where id not in (select site_id from site_payroll_rules);

-- =====================================================================
-- VERIFY — expect `special` present and one rules row per site
--
--   select column_name from information_schema.columns
--   where table_name = 'salary_structures' and column_name = 'special';
--
--   select s.code, r.pf_base, r.pf_wage_ceiling, r.ph_ot_multiplier,
--          r.bonus_monthly, r.sheet_template
--   from site_payroll_rules r join sites s on s.id = r.site_id
--   order by s.code;
-- =====================================================================
