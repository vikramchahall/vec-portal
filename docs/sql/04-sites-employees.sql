-- =====================================================================
-- Vikram Engineering Co. — PHASE 2 (part 2): sites, employees, documents
-- Supabase project: swpkutpeimuoomculpbz
--
-- Run AFTER 02-auth.sql (and 03-fix-role-guard.sql if you ran an old 02).
-- Paste the whole file into the SQL Editor. Safe to re-run.
--
-- Creates:
--   * sites                — one row per work site
--   * employees            — the HR master record
--   * employee_documents   — pointers to files in Storage
--   * a PRIVATE `employee-docs` storage bucket + its policies
--   * RLS on all of it, driven by can_access_site()
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type employee_status as enum ('active', 'left', 'transferred');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_grade as enum
    ('UNSKILLED', 'SEMI-SKILLED', 'SKILLED', 'HIGHLY SKILLED', 'STAFF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum
    ('aadhaar', 'pan', 'bank_proof', 'photo', 'medical', 'gate_pass',
     'police_verification', 'safety_training', 'pf_nomination',
     'qualification', 'experience', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. sites
-- ---------------------------------------------------------------------
create table if not exists sites (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null,
  client_name        text,
  principal_employer text,
  city               text,
  state              text,
  -- Printed at the top of that site's wage slips.
  header_line_1      text,
  header_line_2      text,
  started_on         date,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create index if not exists sites_active_idx on sites (is_active, name);

-- ---------------------------------------------------------------------
-- 2. employees
--
-- Column names follow the client master sheets so an Excel import maps
-- across without translation.
-- ---------------------------------------------------------------------
create table if not exists employees (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites on delete restrict,

  -- Identity
  emp_code         text,
  full_name        text not null,
  father_name      text,
  gender           text,
  dob              date,
  mobile           text,
  email            text,
  address          text,

  -- Engagement
  designation      text,
  category         skill_grade,
  doj              date,
  dol              date,
  status           employee_status not null default 'active',

  -- Statutory
  aadhaar_last4    text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  uan              text,
  pf_account_no    text,
  esi_number       text,
  pf_applicable    boolean not null default true,
  esi_applicable   boolean not null default true,

  -- Payment
  bank_name        text,
  bank_account_no  text,
  ifsc             text,

  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A client-issued code must be unique within its site, but many sites
  -- legitimately reuse simple serials, so the constraint is per-site.
  unique (site_id, emp_code)
);

create index if not exists employees_site_idx   on employees (site_id, status, full_name);
create index if not exists employees_name_idx   on employees (full_name);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employees_touch on employees;
create trigger employees_touch
  before update on employees
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. employee_documents
--
-- Only a pointer lives here; the bytes live in Storage. Keeping size on
-- the row means the storage dashboard can be built without listing the
-- bucket on every page load.
-- ---------------------------------------------------------------------
create table if not exists employee_documents (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  type        document_type not null default 'other',
  label       text,
  file_path   text not null unique,
  file_size   integer,
  mime_type   text,
  expires_on  date,
  uploaded_by uuid references auth.users on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists employee_documents_emp_idx
  on employee_documents (employee_id, type);

-- ---------------------------------------------------------------------
-- 4. RLS
--
-- can_access_site() comes from 02-auth.sql: admins see every site, HR
-- sees only the sites listed in their profile (or all, if site_ids null).
-- ---------------------------------------------------------------------
alter table sites              enable row level security;
alter table employees          enable row level security;
alter table employee_documents enable row level security;

-- --- sites -----------------------------------------------------------
drop policy if exists "staff read sites" on sites;
create policy "staff read sites"
  on sites for select to authenticated
  using (public.can_access_site(id));

drop policy if exists "staff add sites" on sites;
create policy "staff add sites"
  on sites for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "staff edit sites" on sites;
create policy "staff edit sites"
  on sites for update to authenticated
  using (public.can_access_site(id))
  with check (public.can_access_site(id));

drop policy if exists "admin deletes sites" on sites;
create policy "admin deletes sites"
  on sites for delete to authenticated
  using (public.is_admin());

-- --- employees -------------------------------------------------------
drop policy if exists "staff read employees" on employees;
create policy "staff read employees"
  on employees for select to authenticated
  using (public.can_access_site(site_id));

drop policy if exists "staff add employees" on employees;
create policy "staff add employees"
  on employees for insert to authenticated
  with check (public.can_access_site(site_id));

drop policy if exists "staff edit employees" on employees;
create policy "staff edit employees"
  on employees for update to authenticated
  using (public.can_access_site(site_id))
  with check (public.can_access_site(site_id));

-- Deliberately admin-only. An employee row is a wage record; HR marks
-- someone 'left' rather than deleting the history.
drop policy if exists "admin deletes employees" on employees;
create policy "admin deletes employees"
  on employees for delete to authenticated
  using (public.is_admin());

-- --- employee_documents ----------------------------------------------
drop policy if exists "staff read documents" on employee_documents;
create policy "staff read documents"
  on employee_documents for select to authenticated
  using (exists (
    select 1 from employees e
    where e.id = employee_id and public.can_access_site(e.site_id)
  ));

drop policy if exists "staff add documents" on employee_documents;
create policy "staff add documents"
  on employee_documents for insert to authenticated
  with check (exists (
    select 1 from employees e
    where e.id = employee_id and public.can_access_site(e.site_id)
  ));

drop policy if exists "staff remove documents" on employee_documents;
create policy "staff remove documents"
  on employee_documents for delete to authenticated
  using (exists (
    select 1 from employees e
    where e.id = employee_id and public.can_access_site(e.site_id)
  ));

-- ---------------------------------------------------------------------
-- 5. Storage bucket — PRIVATE
--
-- These files are Aadhaar cards and bank proofs. The bucket must never
-- be public: access is only ever through a short-lived signed URL.
--
-- Paths are  employee-docs/<employee_id>/<uuid>.<ext>
-- so the first path segment identifies the employee for the policies.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-docs', 'employee-docs', false, 5242880)  -- 5 MB ceiling
on conflict (id) do update
  set public = false, file_size_limit = 5242880;

drop policy if exists "staff read employee docs" on storage.objects;
create policy "staff read employee docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-docs'
    and exists (
      select 1 from employees e
      where e.id::text = (storage.foldername(name))[1]
        and public.can_access_site(e.site_id)
    )
  );

drop policy if exists "staff upload employee docs" on storage.objects;
create policy "staff upload employee docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-docs'
    and exists (
      select 1 from employees e
      where e.id::text = (storage.foldername(name))[1]
        and public.can_access_site(e.site_id)
    )
  );

drop policy if exists "staff delete employee docs" on storage.objects;
create policy "staff delete employee docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employee-docs'
    and exists (
      select 1 from employees e
      where e.id::text = (storage.foldername(name))[1]
        and public.can_access_site(e.site_id)
    )
  );

-- ---------------------------------------------------------------------
-- 6. Seed the four live sites
-- ---------------------------------------------------------------------
insert into sites (code, name, client_name, principal_employer, city, state,
                   header_line_1, header_line_2, started_on) values
 ('WB-REF', 'Water Block — HMEL Refinery', 'HPCL-Mittal Energy Ltd',
  'Aquatech Systems Asia Pvt Ltd', 'Bathinda', 'Punjab',
  'VIKRAM ENGINEERING CO. A SUB CONTRACTOR OF AQUATECH SYSTEMS ASIA PVT. LTD.',
  'Plant- WB-REF-HMEL - Bathinda Site', '2018-01-01'),

 ('ETP-REF', 'Effluent Treatment Plant — HMEL Refinery', 'HPCL-Mittal Energy Ltd',
  'Aquatech Systems Asia Pvt Ltd', 'Bathinda', 'Punjab',
  'VIKRAM ENGINEERING CO. A SUB CONTRACTOR OF AQUATECH SYSTEMS ASIA PVT. LTD.',
  'Plant- ETP-REFINARY-HMEL - Bathinda Site', '2018-01-01'),

 ('HZL-DEBARI', 'RO-DM Plant — Zinc Smelter Debari', 'Hindustan Zinc Ltd',
  null, 'Udaipur', 'Rajasthan',
  'Vikram Engineering Co.', 'ZINC SMELTER DEBARI', '2025-04-10'),

 ('OTHER-HMEL', 'Transport & General Services — HMEL', 'HPCL-Mittal Energy Ltd',
  'Aquatech Systems Asia Pvt Ltd', 'Bathinda', 'Punjab',
  'VIKRAM ENGINEERING CO. A SUB CONTRACTOR OF AQUATECH SYSTEMS ASIA PVT. LTD.',
  'Plant-OTHER- HMEL Bathinda Site', null)
on conflict (code) do update set
  name = excluded.name,
  client_name = excluded.client_name,
  principal_employer = excluded.principal_employer,
  city = excluded.city,
  state = excluded.state,
  header_line_1 = excluded.header_line_1,
  header_line_2 = excluded.header_line_2;

-- =====================================================================
-- VERIFY
--
--   select code, name, city from sites order by code;
--   -- expect 4 rows
--
--   select id, name, public, file_size_limit from storage.buckets
--   where id = 'employee-docs';
--   -- public MUST be false
-- =====================================================================
