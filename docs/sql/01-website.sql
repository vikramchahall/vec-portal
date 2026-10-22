-- =====================================================================
-- Vikram Engineering Co. — PHASE 1: public website
-- Supabase project: swpkutpeimuoomculpbz
--
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- It is safe to re-run: every statement is idempotent.
--
-- What this does NOT create: employees, attendance, payroll, invoices.
-- Those come in phase 2 with the portal login, so that nothing holding
-- wage data exists before there is an authenticated user to own it.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type enquiry_type as enum ('enquiry','tender_invite','vendor_registration');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('new','shortlisted','rejected','hired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. enquiries   — written by the public Contact form
-- ---------------------------------------------------------------------
create table if not exists enquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 120),
  phone      text check (phone is null or length(phone) <= 20),
  email      text check (email is null or length(email) <= 160),
  company    text check (company is null or length(company) <= 120),
  message    text not null check (length(message) between 1 and 2000),
  type       enquiry_type not null default 'enquiry',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists enquiries_inbox_idx
  on enquiries (handled, created_at desc);

-- ---------------------------------------------------------------------
-- 2. job_applications   — written by the public Careers form
-- ---------------------------------------------------------------------
create table if not exists job_applications (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 1 and 120),
  phone            text not null check (length(phone) between 7 and 20),
  email            text check (email is null or length(email) <= 160),
  city             text check (city is null or length(city) <= 120),
  position_applied text not null check (length(position_applied) <= 120),
  experience_years numeric(4,1) check (experience_years is null
                                       or experience_years between 0 and 60),
  resume_path      text,          -- phase 2, once a storage bucket exists
  message          text check (message is null or length(message) <= 2000),
  status           application_status not null default 'new',
  created_at       timestamptz not null default now()
);

create index if not exists job_applications_inbox_idx
  on job_applications (status, created_at desc);

-- ---------------------------------------------------------------------
-- 3. projects   — the public Projects page, once you want to edit it
--    without a redeploy. Until then the site reads lib/content.ts.
-- ---------------------------------------------------------------------
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique,
  client       text not null,
  title        text not null,
  city         text,
  state        text,
  period_text  text,
  description  text,
  image_slug   text,
  category     text,
  headcount    smallint,
  is_live      boolean not null default false,
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  sort_order   smallint not null default 0
);

create index if not exists projects_public_idx
  on projects (is_published, is_live, sort_order);

-- ---------------------------------------------------------------------
-- 4. site_images   — lets HR swap a stock photo for a real site photo
--    from the portal, with no code change.
-- ---------------------------------------------------------------------
create table if not exists site_images (
  slug       text primary key,
  url        text,
  local_path text,
  alt_text   text,
  credit     text,
  is_stock   boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. openings   — vacancies listed on the Careers page
-- ---------------------------------------------------------------------
create table if not exists openings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  city        text,
  grade       text,
  description text,
  vacancies   smallint,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. app_settings   — registration numbers shown on /compliance.
--    Stored as rows so they can be corrected without a deploy.
-- ---------------------------------------------------------------------
create table if not exists app_settings (
  key        text primary key,
  value      text,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
--
-- The website talks to Supabase with the ANON key, which ships to the
-- browser. Treat it as public. The rules below are therefore the only
-- thing standing between that key and your data:
--
--   * anyone may INSERT an enquiry or an application
--   * NOBODY may SELECT them without logging in  <-- the important one
--   * published content is world-readable
-- =====================================================================

alter table enquiries        enable row level security;
alter table job_applications enable row level security;
alter table projects         enable row level security;
alter table site_images      enable row level security;
alter table openings         enable row level security;
alter table app_settings     enable row level security;

-- --- Forms: insert-only for the public ------------------------------
drop policy if exists "anon can submit an enquiry" on enquiries;
create policy "anon can submit an enquiry"
  on enquiries for insert to anon, authenticated
  with check (true);

drop policy if exists "signed-in staff can read enquiries" on enquiries;
create policy "signed-in staff can read enquiries"
  on enquiries for select to authenticated
  using (true);

drop policy if exists "anon can submit an application" on job_applications;
create policy "anon can submit an application"
  on job_applications for insert to anon, authenticated
  with check (true);

drop policy if exists "signed-in staff can read applications" on job_applications;
create policy "signed-in staff can read applications"
  on job_applications for select to authenticated
  using (true);

-- Note: no UPDATE or DELETE policy is defined for either table, so
-- neither anon nor a signed-in user can alter or remove submissions.
-- Phase 2 adds admin-only update policies for marking them handled.

-- --- Published content: world-readable ------------------------------
drop policy if exists "published projects are public" on projects;
create policy "published projects are public"
  on projects for select to anon, authenticated
  using (is_published);

drop policy if exists "images are public" on site_images;
create policy "images are public"
  on site_images for select to anon, authenticated
  using (true);

drop policy if exists "open positions are public" on openings;
create policy "open positions are public"
  on openings for select to anon, authenticated
  using (is_open);

drop policy if exists "public settings are public" on app_settings;
create policy "public settings are public"
  on app_settings for select to anon, authenticated
  using (is_public);

-- =====================================================================
-- SEED — registration details
-- =====================================================================
insert into app_settings (key, value, is_public) values
  ('gstin',            '03ANIPS5337H1ZW',   true),
  ('gst_legal_name',   'HARJEET SINGH',     true),
  ('gst_trade_name',   'VIKRAM ENGINEERING CO.', true),
  ('gst_liable_since', '2017-07-01',        true),
  ('epfo_est_id',      'PBBTI0028877000',   true),
  ('epfo_office',      'BHATINDA (BTI)',    true),
  ('esic_employer_code','12000531400001001', true),
  ('lin',              '1966443026',        true),
  ('nic_code',         'F-42901',           true),
  ('constitution',     'Proprietorship',    true),
  ('office_address',   'B-526, Sushant City Phase-II, Mansa Road, Bathinda, Punjab - 151001', true),
  ('email',            'vikramengineeringco@gmail.com', true),
  -- PAN is deliberately NOT public. It is already derivable from the
  -- GSTIN, but there is no reason to print it as its own field.
  ('pan',              'ANIPS5337H',        false)
on conflict (key) do update
  set value = excluded.value, updated_at = now();

-- =====================================================================
-- SEED — projects (matches lib/content.ts)
-- =====================================================================
insert into projects (ref, client, title, city, state, period_text, category,
                      headcount, is_live, is_featured, sort_order, image_slug, description) values
 ('WB-REF','HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd','Water Block — HMEL Refinery','Bathinda','Punjab','Since 2018','om-plants',78,true,true,1,'wtp-aerial-3','Complete O&M of the refinery Water Block — round-the-clock shift operation, mechanical, electrical and instrumentation maintenance, rigging, welding, fitting and gas cutting, chemical dosing, lab testing, housekeeping, safety supervision and admin support.'),
 ('ETP-REF','HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd','Effluent Treatment Plant — HMEL Refinery','Bathinda','Punjab','Since 2018','om-plants',48,true,true,2,'etp-aerial','Complete O&M of the refinery Effluent Treatment Plant — field operation across shifts, effluent monitoring and lab chemistry, mechanical fitting and welding, rigging, electrical and instrument technician work, horticulture, housekeeping and safety.'),
 ('HZL-DEBARI','Hindustan Zinc Ltd','RO-DM Plant — Zinc Smelter Debari','Udaipur','Rajasthan','Since April 2025','om-plants',33,true,true,3,'smelter-molten','O&M manpower for the RO-DM plant at the zinc smelter — plant operation, mechanical and electrical maintenance, junior engineering supervision, lab chemistry and helper support.'),
 ('OTHER-HMEL','HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd','Transport & General Services — HMEL Refinery','Bathinda','Punjab','Ongoing','site-services',6,true,false,4,'transport-buses','Dedicated driver pool and civil supervision for plant transport, in-plant material shifting and sludge disposal.'),
 ('C10','HPCL-Mittal Energy Ltd','Raw Water Channel Cleaning & Patrolling — Rate Contract','Bathinda','Punjab','May 2022 – April 2023','site-services',null,false,false,10,'water-channel','Second renewal of the raw water channel contract, awarded as an annual rate contract for the Guru Gobind Singh Refinery.'),
 ('C9','HPCL-Mittal Energy Ltd','Raw Water Channel Cleaning & Patrolling — Renewal','Bathinda','Punjab','April 2019 – April 2020','site-services',null,false,false,11,'water-channel','First renewal of the channel cleaning and patrolling contract, re-awarded on satisfactory performance.'),
 ('C8','Engineers India Ltd — a Govt. of India Undertaking','Manpower & Housekeeping — BS-VI Project','Bathinda','Punjab','24 months from May 2018','manpower',null,false,true,12,'workers-hardhats','Secretarial, Data Entry and SAP Operator, Office Assistant and Messenger at the EIL site office; Cook-cum-Caretaker, Helpers and complete janitorial services at the EIL transit accommodation.'),
 ('C7','SUEZ India Pvt Ltd','Complete Transportation Services','Bathinda','Punjab','January – December 2018','site-services',null,false,false,13,'transport-buses','24x7 transport between the guest house and the WTP and EPT plants — a 40-seater deluxe mini bus, three Mahindra Boleros and two tractor-and-twin-trolley sets for sludge disposal.'),
 ('C6','SUEZ India Pvt Ltd','Complete Guest-House Services','Bathinda','Punjab','January – December 2018','site-services',null,false,false,14,'refinery-day','36 fully furnished rooms with rent and accommodation management, round-the-clock housekeeping, cook management and common mess operation.'),
 ('C5','SUEZ India Pvt Ltd','Manpower Services — RODM & ETP Plants','Bathinda','Punjab','January – December 2018','manpower',null,false,false,15,'operator-panel','Greasing, lubricating, finishing and cleaning of units and equipment; chemical preparation and dosing; assisting equipment rectification; periodical cleaning of all civil process units.'),
 ('C4','HPCL-Mittal Energy Ltd','Raw Water Channel Cleaning & Patrolling','Bathinda','Punjab','August 2017 – March 2018','site-services',null,false,false,16,'water-channel','Monitoring and cleaning the canal from the Bangi head channel to the Kotla Canal plant intake — one man per shift round the clock.'),
 ('C3','Triveni Engineering & Industries Ltd','Mechanical Painting & Protective Coating','Bathinda','Punjab','From July 2016','painting',null,false,true,17,'spray-painting','2,357 m2 of piping, supports and equipment painted; 90 m of underground pipeline wrapped and coated; structural sheds and 25+ canopies; eye-wash fountains and fume absorbers.'),
 ('C2','Geo Miller & Co. Pvt Ltd — for UP Jal Nigam','PSC Pipeline Laying — 26 MLD STP','Jhansi','Uttar Pradesh','From April 2016','pipeline',null,false,true,18,'stp-aerial-2','Roughly 2,300 running metres of 600 mm and 350 mm PSC pipeline, 3,300 cum of excavation to 3 m, layer-wise compacted backfill, 10 valve chambers and 25 thrust blocks.'),
 ('C1','SN Enviro-Tech Pvt Ltd','Erection, Testing & Commissioning — 10 MLD STP','Sriganganagar','Rajasthan','From September 2015','erection',null,false,false,19,'stp-aerial-1','Full mechanical scope for a 10 MLD sewage treatment plant executed to GA drawings, through trial run, commissioning and a one-year defect liability period.')
on conflict (ref) do update set
  client = excluded.client, title = excluded.title, city = excluded.city,
  state = excluded.state, period_text = excluded.period_text,
  category = excluded.category, headcount = excluded.headcount,
  is_live = excluded.is_live, is_featured = excluded.is_featured,
  sort_order = excluded.sort_order, image_slug = excluded.image_slug,
  description = excluded.description;

-- =====================================================================
-- SEED — image manifest (all Pexels ids verified to return HTTP 200)
-- =====================================================================
insert into site_images (slug, url, local_path, alt_text, credit, is_stock) values
 ('hero-refinery-night','https://images.pexels.com/photos/10407689/pexels-photo-10407689.jpeg','/images/hero-refinery-night.jpg','Oil refinery lit up at night','Pexels',true),
 ('refinery-day','https://images.pexels.com/photos/15970032/pexels-photo-15970032.jpeg','/images/refinery-day.jpg','Refinery plant with pipework','Pexels',true),
 ('etp-aerial','https://images.pexels.com/photos/19517566/pexels-photo-19517566.jpeg','/images/etp-aerial.jpg','Effluent treatment plant','Pexels',true),
 ('stp-aerial-1','https://images.pexels.com/photos/19281034/pexels-photo-19281034.jpeg','/images/stp-aerial-1.jpg','Sewage treatment plant from above','Pexels',true),
 ('stp-aerial-2','https://images.pexels.com/photos/5712211/pexels-photo-5712211.jpeg','/images/stp-aerial-2.jpg','Aerial view of a sewage treatment plant','Pexels',true),
 ('wtp-aerial-3','https://images.pexels.com/photos/3808769/pexels-photo-3808769.jpeg','/images/wtp-aerial-3.jpg','Aerial view of a water treatment plant','Pexels',true),
 ('wtp-aerial-4','https://images.pexels.com/photos/5131196/pexels-photo-5131196.jpeg','/images/wtp-aerial-4.jpg','Water treatment plant from above','Pexels',true),
 ('workers-safety-gear','https://images.pexels.com/photos/32845683/pexels-photo-32845683.jpeg','/images/workers-safety-gear.jpg','Industrial workers in safety gear','Pexels',true),
 ('workers-hardhats','https://images.pexels.com/photos/4956920/pexels-photo-4956920.jpeg','/images/workers-hardhats.jpg','Group of workers wearing hard hats','Pexels',true),
 ('engineer-inspecting','https://images.pexels.com/photos/2760241/pexels-photo-2760241.jpeg','/images/engineer-inspecting.jpg','Engineer inspecting machinery','Pexels',true),
 ('welding-sparks','https://images.pexels.com/photos/29976478/pexels-photo-29976478.jpeg','/images/welding-sparks.jpg','Industrial welding with sparks','Pexels',true),
 ('welder-at-work','https://images.pexels.com/photos/15888226/pexels-photo-15888226.jpeg','/images/welder-at-work.jpg','Welder at work in protective gear','Pexels',true),
 ('welding-metal','https://images.pexels.com/photos/2760343/pexels-photo-2760343.jpeg','/images/welding-metal.jpg','Person welding metal','Pexels',true),
 ('trench-worker','https://images.pexels.com/photos/15099463/pexels-photo-15099463.jpeg','/images/trench-worker.jpg','Worker in a trench at a construction site','Pexels',true),
 ('spray-painting','https://images.pexels.com/photos/6870314/pexels-photo-6870314.jpeg','/images/spray-painting.jpg','Worker using a paint spray gun','Pexels',true),
 ('pipes-valves','https://images.pexels.com/photos/29248902/pexels-photo-29248902.jpeg','/images/pipes-valves.jpg','Industrial pipes with coloured valves','Pexels',true),
 ('valve-large-pipe','https://images.pexels.com/photos/13726337/pexels-photo-13726337.jpeg','/images/valve-large-pipe.jpg','Valve on a large pipe','Pexels',true),
 ('gas-pipeline','https://images.pexels.com/photos/3229014/pexels-photo-3229014.jpeg','/images/gas-pipeline.jpg','Industrial pipeline at a plant','Pexels',true),
 ('control-room','https://images.pexels.com/photos/33706880/pexels-photo-33706880.jpeg','/images/control-room.jpg','Industrial electrical control room','Pexels',true),
 ('operator-panel','https://images.pexels.com/photos/35072831/pexels-photo-35072831.jpeg','/images/operator-panel.jpg','Worker operating a control panel','Pexels',true),
 ('smelter-molten','https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg','/images/smelter-molten.jpg','Molten metal in a foundry ladle','Pexels',true),
 ('transport-buses','https://images.pexels.com/photos/18029643/pexels-photo-18029643.jpeg','/images/transport-buses.jpg','Buses parked in a lot','Pexels',true),
 ('water-channel','https://images.pexels.com/photos/14108476/pexels-photo-14108476.jpeg','/images/water-channel.jpg','Concrete structure beside flowing water','Pexels',true)
on conflict (slug) do update set
  url = excluded.url, local_path = excluded.local_path,
  alt_text = excluded.alt_text, updated_at = now();

-- =====================================================================
-- VERIFY — run this after the script and read the output
-- =====================================================================
-- select tablename,
--        (select count(*) from pg_policies p where p.tablename = t.tablename) as policies,
--        rowsecurity as rls_on
-- from pg_tables t
-- where schemaname = 'public'
-- order by tablename;
--
-- Expected: 6 tables, rls_on = true on every one.
-- enquiries and job_applications must have exactly 2 policies each
-- (insert for anon, select for authenticated) and NO update/delete.
