-- =====================================================================
-- Row Level Security.
-- Rule of thumb:
--   * anon      -> may INSERT enquiries / job_applications, may SELECT
--                  published projects and open positions. Nothing else.
--   * hr        -> everything operational, scoped to its sites.
--   * admin     -> everything, all sites, plus money and user management.
-- Tables without a site_id reach their site through a join.
-- =====================================================================

alter table profiles            enable row level security;
alter table categories          enable row level security;
alter table designations        enable row level security;
alter table minimum_wages       enable row level security;
alter table sites               enable row level security;
alter table site_rules          enable row level security;
alter table work_orders         enable row level security;
alter table employees           enable row level security;
alter table salary_structures   enable row level security;
alter table attendance_months   enable row level security;
alter table ot_justifications   enable row level security;
alter table leave_balances      enable row level security;
alter table payroll_runs        enable row level security;
alter table payroll_lines       enable row level security;
alter table billing_rates       enable row level security;
alter table invoices            enable row level security;
alter table site_expenses       enable row level security;
alter table employee_documents  enable row level security;
alter table projects            enable row level security;
alter table openings            enable row level security;
alter table tenders             enable row level security;
alter table enquiries           enable row level security;
alter table job_applications    enable row level security;
alter table app_settings        enable row level security;
alter table audit_log           enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- masters: staff read, admin write
-- ---------------------------------------------------------------------
create policy categories_read on categories for select using (is_staff());
create policy categories_write on categories for all using (is_admin()) with check (is_admin());

create policy designations_read on designations for select using (is_staff());
create policy designations_write on designations for all using (is_admin()) with check (is_admin());

create policy minimum_wages_read on minimum_wages for select using (is_staff());
create policy minimum_wages_write on minimum_wages for all using (is_admin()) with check (is_admin());

create policy app_settings_read on app_settings for select using (is_staff());
create policy app_settings_write on app_settings for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- sites and their rules
-- ---------------------------------------------------------------------
create policy sites_read on sites for select using (can_access_site(id));
create policy sites_write on sites for all using (is_admin()) with check (is_admin());

create policy site_rules_read on site_rules for select using (can_access_site(site_id));
create policy site_rules_write on site_rules for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- employees and pay structures
-- ---------------------------------------------------------------------
create policy employees_read on employees for select using (can_access_site(site_id));
create policy employees_write on employees for all
  using (can_access_site(site_id)) with check (can_access_site(site_id));

create policy salary_structures_rw on salary_structures for all
  using (exists (select 1 from employees e
                 where e.id = salary_structures.employee_id and can_access_site(e.site_id)))
  with check (exists (select 1 from employees e
                 where e.id = salary_structures.employee_id and can_access_site(e.site_id)));

create policy employee_documents_rw on employee_documents for all
  using (exists (select 1 from employees e
                 where e.id = employee_documents.employee_id and can_access_site(e.site_id)))
  with check (exists (select 1 from employees e
                 where e.id = employee_documents.employee_id and can_access_site(e.site_id)));

create policy leave_balances_rw on leave_balances for all
  using (exists (select 1 from employees e
                 where e.id = leave_balances.employee_id and can_access_site(e.site_id)))
  with check (exists (select 1 from employees e
                 where e.id = leave_balances.employee_id and can_access_site(e.site_id)));

-- ---------------------------------------------------------------------
-- attendance and payroll
-- ---------------------------------------------------------------------
create policy attendance_rw on attendance_months for all
  using (can_access_site(site_id)) with check (can_access_site(site_id));

create policy ot_just_rw on ot_justifications for all
  using (can_access_site(site_id)) with check (can_access_site(site_id));

create policy payroll_runs_rw on payroll_runs for all
  using (can_access_site(site_id)) with check (can_access_site(site_id));

create policy payroll_lines_rw on payroll_lines for all
  using (exists (select 1 from payroll_runs r
                 where r.id = payroll_lines.run_id and can_access_site(r.site_id)))
  with check (exists (select 1 from payroll_runs r
                 where r.id = payroll_lines.run_id and can_access_site(r.site_id)));

-- A finalized run is history. Corrections create version N+1 instead.
create or replace function forbid_final_payroll_edit() returns trigger
  language plpgsql as $fn$
declare
  run_status payroll_status;
begin
  select status into run_status from payroll_runs
   where id = coalesce(new.run_id, old.run_id);
  if run_status = 'final' then
    raise exception 'payroll run is final; create a new version to correct it';
  end if;
  return coalesce(new, old);
end;
$fn$;

create trigger payroll_lines_immutable
  before insert or update or delete on payroll_lines
  for each row execute function forbid_final_payroll_edit();

-- ---------------------------------------------------------------------
-- money: admin only
-- ---------------------------------------------------------------------
create policy billing_rates_admin on billing_rates for all
  using (is_admin()) with check (is_admin());
create policy invoices_admin on invoices for all
  using (is_admin()) with check (is_admin());
create policy site_expenses_admin on site_expenses for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- work orders (HR reads, admin writes) and tenders (both edit)
-- ---------------------------------------------------------------------
create policy work_orders_read on work_orders for select using (is_staff());
create policy work_orders_write on work_orders for all using (is_admin()) with check (is_admin());

create policy tenders_rw on tenders for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- public site
-- ---------------------------------------------------------------------
create policy projects_public_read on projects for select
  using (is_published or is_staff());
create policy projects_write on projects for all using (is_admin()) with check (is_admin());

create policy openings_public_read on openings for select
  using (is_open or is_staff());
create policy openings_write on openings for all using (is_staff()) with check (is_staff());

-- Anonymous visitors may only drop a row in. They can never read one back.
create policy enquiries_anon_insert on enquiries for insert to anon, authenticated with check (true);
create policy enquiries_staff_read on enquiries for select using (is_staff());
create policy enquiries_staff_update on enquiries for update using (is_staff()) with check (is_staff());

create policy applications_anon_insert on job_applications for insert to anon, authenticated with check (true);
create policy applications_staff_read on job_applications for select using (is_staff());
create policy applications_staff_update on job_applications for update using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- audit log: append-only, admin reads
-- ---------------------------------------------------------------------
create policy audit_insert on audit_log for insert to authenticated with check (is_staff());
create policy audit_admin_read on audit_log for select using (is_admin());

-- ---------------------------------------------------------------------
-- housekeeping
-- ---------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
  language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger employees_touch before update on employees
  for each row execute function touch_updated_at();
create trigger attendance_touch before update on attendance_months
  for each row execute function touch_updated_at();
