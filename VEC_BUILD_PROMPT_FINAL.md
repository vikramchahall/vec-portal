# BUILD PROMPT — Vikram Engineering Co. website + payroll portal

**This is the complete, self-contained brief. It supersedes `VEC_WEBSITE_BUILD_PROMPT.md`.**

You are building a production web application for a real Indian engineering contracting firm. Two things in one product:

1. A **public website** that wins work — company profile, proven experience, services, careers, enquiries.
2. A **private portal** that replaces a stack of Excel files — sites, employees, attendance, monthly payroll, Form XIX salary slips, statutory returns, billing and profit reporting.

The payroll engine is the heart of it. Everything else supports it. Get the arithmetic exactly right — these are real wages paid to real people, and the client audits them.

---

## 1. Tech stack (fixed — do not substitute)

- **Next.js 15** (App Router, TypeScript, Server Components by default), **Tailwind CSS**, **shadcn/ui**
- **Supabase**: Postgres, Auth (email+password), Row Level Security, Storage. Migrations in `/supabase/migrations` via the Supabase CLI. No ORM — use `@supabase/ssr` with generated types (`supabase gen types typescript`).
- **TanStack Table** for the Excel-like grids, **Recharts** for graphs
- **@react-pdf/renderer** for salary slips and registers (client-side generation — nothing uploaded)
- **SheetJS (xlsx)** for Excel import/export (client-side)
- **Zod** for every form and every import mapping
- **Vitest** for the payroll calculator tests
- Deploy on **Vercel** free tier; Supabase free tier. Design every decision to stay inside those limits.

---

## 2. Company facts

| Field | Value |
|---|---|
| Legal name | Vikram Engineering Co. (proprietorship) |
| Short form used by clients | **VEC** |
| Proprietor | Harjeet Singh |
| Office (as printed on salary slips) | Sushant City-2, Bathinda, Punjab – 151001 |
| Older address on work orders | H. No. 21975, Street No. 11, Dhobiana Road, Bathinda – 151001 |
| Email | vikramengineeringco@gmail.com |
| Phone | 09417485423 / 09872163824 |
| Track record | 2015 → 2026 (11+ years) |
| Workers on payroll | 160+ across 4 live sites |
| States | Punjab, Rajasthan, Uttar Pradesh |

**Vendor / contractor codes** — HMEL `1900005225` · HZL contractor `004942`, sub-contract WO `5100033705` · Triveni `105302`

**Nature of business:** O&M of water, effluent and RO-DM treatment plants; contract manpower supply; mechanical erection, testing and commissioning; pipeline laying and civil works; industrial painting and protective coating; site support services (channel cleaning, housekeeping, guest house, transport).

---

## 3. Experience — seed `projects` and `sites` with exactly this

### Live contracts (running today)

| Code | Site | Client / principal | Location | Since | Headcount | Work |
|---|---|---|---|---|---|---|
| `WB-REF` | **Water Block — HMEL Refinery** | HPCL-Mittal Energy Ltd, via **Aquatech Systems Asia Pvt Ltd** (VEC is sub-contractor) | Bathinda, Punjab | 2018 | **78** | Complete O&M of the refinery Water Block — round-the-clock shift operation, mechanical/electrical/instrumentation maintenance, rigging, welding, fitting, gas cutting, chemical dosing, lab testing, housekeeping, safety supervision, gate-pass and admin support. 17 trades, from Helper to PLC Engineer. |
| `ETP-REF` | **ETP — HMEL Refinery** | HPCL-Mittal Energy Ltd, via **Aquatech Systems Asia Pvt Ltd** | Bathinda, Punjab | 2018 | 48–59 | Complete O&M of the refinery Effluent Treatment Plant — field operation across shifts, effluent monitoring and lab chemistry, mechanical fitting and welding, rigging, electrical and instrument technician work, horticulture, housekeeping, shift-incharge supervision, safety. |
| `OTHER-HMEL` | **Transport & general services — HMEL** | via Aquatech | Bathinda, Punjab | — | 6–9 | Dedicated driver pool and civil supervision for plant transport, in-plant material shifting and sludge disposal. Separate payroll. |
| `HZL-DEBARI` | **Zinc Smelter Debari** | **Hindustan Zinc Ltd** (direct) | Debari, Udaipur, Rajasthan | Apr 2025 | **33** | O&M manpower for the RO-DM plant — plant operation, mechanical and electrical maintenance, junior engineering supervision, lab chemistry, helper support. Runs on HZL's own contractor master-data format. |

> **The headline claim for the site:** VEC has been on HMEL's water and effluent plants **continuously since January 2018** — first under SUEZ India, then as sub-contractor to Aquatech Systems Asia. Eight years inside a BS-VI refinery, retained across a change of principal contractor.

### Completed contracts

| Ref | Client | Location | Period | Work |
|---|---|---|---|---|
| C1 | SN Enviro-Tech Pvt Ltd | Sriganganagar, Rajasthan | from Sep 2015 | Erection, testing and commissioning of mechanical equipment and allied works for a **10 MLD Sewage Treatment Plant** — full mechanical scope to GA drawings, own hydra/crane/welding sets, through trial run, commissioning and a 1-year defect liability period. |
| C2 | Geo Miller & Co. Pvt Ltd *(for UP Jal Nigam)* | Jhansi, Uttar Pradesh | from Apr 2016 | **PSC pipeline laying for a 26 MLD STP** — four lines (SPS-1→STP 600 mm; SPS-2→STP, SPS-3→SPS-2, STP→Lake all 350 mm). ~2,300 Rm of pipeline, 3,300 cum excavation to 3 m, layer-wise compacted backfill, 10 valve chambers, 25 thrust blocks. VEC supplied all construction material, plant, machinery, survey equipment and site lighting for night working. |
| C3 | Triveni Engineering & Industries Ltd | Bathinda, Punjab | from Jul 2016 | **Mechanical painting and protective coating** across a water treatment plant — 2,357 m² of piping/supports/equipment painted, 90 m of underground pipeline wrapped and coated, structural sheds over chemical dosing area and pump house, 25+ canopies, eye-wash fountains and safety showers, fume absorbers, PLC room AC, instrument air compressors, ladder grouting at 13 tanks, sign boards and arrow marking. |
| C4 | HPCL-Mittal Energy Ltd | GGS Refinery, Bathinda | Aug 2017 – Mar 2018 | **Raw water channel cleaning and patrolling** from Bangi head channel to Kotla Canal plant intake — one man per shift round the clock, inlet gate monitoring, removal and disposal of debris, solids, grasses and bushes. Full HMEL HSSE and PPE compliance. |
| C5 | SUEZ India Pvt Ltd | HMEL Refinery, Bathinda | Jan – Dec 2018 | **Manpower services for the RODM and ETP plants** — greasing, lubricating, finishing and cleaning of units and equipment; chemical preparation and dosing; assisting equipment rectification and repair; periodical cleaning of all civil process units; equipment history cards and daily logbooks. |
| C6 | SUEZ India Pvt Ltd | HMEL Refinery, Bathinda | Jan – Dec 2018 | **Complete guest-house services, 24×7** — 36 furnished rooms with rent and accommodation management, round-the-clock housekeeping, cook management and common mess operation, twice-daily refreshments for all staff on duty. |
| C7 | SUEZ India Pvt Ltd | HMEL Refinery, Bathinda | Jan – Dec 2018 | **Complete transportation services, 24×7** — 40-seater deluxe mini bus, three Mahindra Boleros, two tractor-and-twin-trolley sets for sludge disposal to approved environmental areas. Diesel, drivers, statutory compliance, insurance, maintenance and replacement vehicles all in VEC's scope. |
| C8 | Engineers India Ltd (Govt. of India Undertaking) | HMEL BS-VI Project, Bathinda | 24 months from May 2018 | **Manpower and housekeeping for the BS-VI Project** — Secretarial/Data Entry/SAP Operator, Office Assistant and Messenger at the EIL site office; Cook-cum-Caretaker, Helpers and complete janitorial services at the transit accommodation. |
| C9 | HPCL-Mittal Energy Ltd | GGS Refinery, Bathinda | Apr 2019 – Apr 2020 | Raw water channel cleaning and patrolling — **first renewal**. |
| C10 | HPCL-Mittal Energy Ltd | GGS Refinery, Bathinda | May 2022 – Apr 2023 | Raw water channel cleaning and patrolling — **rate contract, second renewal**. |

### Clients (logo strip / client list)

HPCL-Mittal Energy Ltd (HMEL) · Hindustan Zinc Ltd · Aquatech Systems Asia Pvt Ltd · Engineers India Ltd · SUEZ India Pvt Ltd · UP Jal Nigam (through Geo Miller) · Geo Miller & Co. Pvt Ltd · Triveni Engineering & Industries Ltd · SN Enviro-Tech Pvt Ltd

### Trades (seed `designations`, taken from the real payroll registers)

- **Highly Skilled** — Rigger, Mechanical Rigger, Mechanical Welder, Safety Officer, Mechanical Supervisor
- **Skilled** — Field Engineer, Field Operator, PLC Engineer, Mechanical Junior Engineer, Shift Incharge, Chemist, Lab Chemist, Fitter, Mechanical Fitter, Welder, Gas Cutter, Grinder, Instrument Technician, Instrument Supervisor, Electrical Technician, Electrician, Electrical Supervisor, Mechanical Technician, Safety Officer, Assistant Safety Officer, Housekeeping Supervisor, Admin Supervisor, Gatepass Supervisor, Civil Supervisor, HR Executive, Driver
- **Semi-Skilled** — Mechanical Helper, Instrument Helper, Lab Boy, Assistant Supervisor
- **Un-Skilled** — Helper, Electrical Helper, Horticulture Helper, Canal/Kotla Helper

---

## 4. Images — stock photography manifest

**Every URL below has been verified to return HTTP 200.** Source: Pexels. Licence: free for commercial use, no attribution required.

### Rules — read these before using any image

1. **Download once at build time, do not hotlink and do not put them in Supabase Storage.** Run `scripts/fetch-images.ts` (write it) to pull each URL into `/public/images/<slug>.jpg`, then serve through `next/image`. This keeps the Supabase Storage quota entirely free for employee documents.
2. **These are generic industry photographs, not photographs of VEC's sites.** Never caption one as "our ETP at Bathinda" or overlay a client's name on it. Caption them by *subject* ("Effluent treatment plant"), and put a small `Representative image` label in the corner of every hero and gallery photo. Passing stock photos off as your own project photography is the kind of thing a client notices during a site visit, and it costs more credibility than the photos gain.
3. **Build a `site_images` table** (`slug, url, local_path, alt_text, credit, is_stock bool, replaces_at null`) and read images from it. The moment Harjeet sends real site photographs, HR swaps them in from the portal with no code change. Show a persistent banner on the admin dashboard: *"N stock images still in use — replace with site photos"*.
4. Append `?auto=compress&cs=tinysrgb&w=1600` to any Pexels URL for a smaller file. Convert to WebP during the fetch script. Target under 200 KB per hero image.

### Manifest

Base URL pattern: `https://images.pexels.com/photos/<ID>/pexels-photo-<ID>.jpeg`

| Slug | ID | Subject | Where it goes |
|---|---|---|---|
| `hero-refinery-night` | `10407689` | Oil refinery lit up at night | **Home hero**, full-bleed, dark overlay, headline on top |
| `refinery-day` | `15970032` | Oil refinery plant with pipework | About page header; Services → O&M section |
| `etp-aerial` | `19517566` | Wastewater treatment plant | Service tile: **O&M of Treatment Plants**; site card for ETP-REF |
| `stp-aerial-1` | `19281034` | Sewage treatment plant, bird's eye | Project C1 (10 MLD STP, Sriganganagar) |
| `stp-aerial-2` | `5712211` | Aerial shot of sewage treatment plant | Project C2 (26 MLD STP, Jhansi) |
| `wtp-aerial-3` | `3808769` | Aerial view of wastewater treatment plant | Site card for WB-REF (Water Block) |
| `wtp-aerial-4` | `5131196` | Bird's eye view of wastewater treatment plant | Services page banner |
| `workers-safety-gear` | `32845683` | Industrial workers in safety gear at a steel plant | Service tile: **Contract Manpower Supply**; Careers page header |
| `workers-hardhats` | `4956920` | Group of workers in hard hats | About → "Our people"; Careers |
| `engineer-inspecting` | `2760241` | Engineer in hi-vis and hard hat inspecting machinery | Compliance / "Why choose us" section |
| `welding-sparks` | `29976478` | Industrial welding with sparks | Service tile: **Mechanical Erection, Testing & Commissioning** |
| `welder-at-work` | `15888226` | A welder at work in protective gear | Trades gallery |
| `welding-metal` | `2760343` | Person welding metal | Trades gallery |
| `trench-worker` | `15099463` | Worker in a trench at a construction site *(shot in Ahmedabad, India)* | Service tile: **Pipeline Laying & Civil Works**; Project C2 |
| `spray-painting` | `6870314` | Person using a paint spray gun | Service tile: **Industrial Painting & Protective Coating**; Project C3 |
| `pipes-valves` | `29248902` | Industrial pipes with coloured valves | Services page texture / section divider |
| `valve-large-pipe` | `13726337` | Valve on a large black pipe | Projects page header |
| `gas-pipeline` | `3229014` | Industrial gas pipeline at a plant | Home → "What we do" band |
| `control-room` | `33706880` | Industrial electrical control room interior | Service tile: **Site Support Services**; portal login page background |
| `operator-panel` | `35072831` | Worker operating a machinery control panel | Home → plant operations section |
| `smelter-molten` | `6804260` | Molten metal in a foundry ladle | Site card for HZL-DEBARI (Zinc Smelter) |
| `transport-buses` | `18029643` | Buses parked in a lot | Project C7 (transportation services) |
| `water-channel` | `14108476` | Concrete structure beside flowing water | Projects C4/C9/C10 (raw water channel cleaning) |

Fallback: if any URL 404s at build time, the fetch script must fail loudly with the slug name — never ship a broken image or a silent placeholder.

---

## 5. Users and roles

- Supabase Auth, **email + password only, no public sign-up**. First admin created by a seed script; admin creates HR users server-side via `auth.admin.createUser` in a route handler using the service-role key.
- `profiles (id uuid pk references auth.users, full_name, role text check (role in ('admin','hr')), site_ids uuid[] null, created_at)`. `site_ids` null = all sites; otherwise HR is restricted to those sites.
- **HR** can: manage sites, employees, attendance, overtime, monthly payroll, slips, documents, exports, tenders, read work orders, read and respond to applications and enquiries.
- **Admin** = everything HR can do, **plus**: billing rates, client invoices, profit dashboard, reports, site expense ledger, user management, audit log, settings.
- **RLS on every business table.** Policies use `is_admin()` and `can_access_site(site_id)` SQL helpers. Public tables (`enquiries`, `job_applications`) allow anonymous INSERT only, guarded by a route handler with rate limiting and a honeypot field.

---

## 6. Domain model (one initial migration; index every FK and `(site_id, month)`)

```
sites                 id, code ('WB-REF','ETP-REF','OTHER-HMEL','HZL-DEBARI'), name, client_name,
                      principal_employer, plant_area, address, state (drives min-wage & LWF rules),
                      work_order_id null, header_line_1, header_line_2, is_active, created_at
                      -- header_line_1 e.g. 'VIKRAM ENGINEERING CO. A SUB CONTRACTOR OF AQUATECH SYSTEMS ASIA PVT. LTD.'
                      -- header_line_2 e.g. 'Plant- WB-REF-HMEL - Bathinda Site'
site_rules            site_id, effective_from date — see §7 (one row per rule version)
categories            id, name ('UNSKILLED','SEMI-SKILLED','SKILLED','HIGHLY SKILLED','STAFF'), sort
designations          id, name, default_category_id
minimum_wages         id, state, category_id, effective_from, basic, da, total
employees             id, site_id, emp_code (client-issued 'ZSD0026611' or register no '46862524'),
                      sl_no, full_name, father_name, gender, dob, doj, dol null, designation_id,
                      category_id, plant_area, esi_number, uan, pf_account_no, pf_applicable,
                      esi_applicable, bank_name, bank_account_no, ifsc, aadhaar_last4, mobile,
                      photo_path null, status ('active','left','transferred'), notes, timestamps
salary_structures     id, employee_id, effective_from, basic, da, hra, conveyance, education, medical,
                      special_or_other, fixed_other, night_shift_rate, is_current
attendance_months     id, site_id, employee_id, month date, days_in_month,
                      day_codes text (31 chars, one per day), ot_hours numeric[31],
                      extra_hours smallint[31], night_shifts, remarks, source, updated_by, updated_at
                      -- ONE row per employee per month. Never one row per day. This is the storage rule.
ot_justifications     id, site_id, month, employee_id, date, work_description, ot_hours, reason
leave_balances        employee_id, as_of_month, cl_balance, el_balance, coff_balance
payroll_runs          id, site_id, month, version, status ('draft','review','final'), days_in_month,
                      ot_divisor, rule_snapshot jsonb, created_by, finalized_by, finalized_at
payroll_lines         id, run_id, employee_id, <every computed number from §8>, hold_amount,
                      leave_encashment, other_deduction_1/2/3, mess_bill, advance_recovery, remarks
billing_rates         id, site_id, effective_from, mode ('service_charge_pct'|'per_category_day_rate'|
                      'fixed_monthly'), service_charge_pct, gst_pct default 18, rates jsonb
invoices              id, site_id, month, run_id, invoice_no, invoice_date, basis_amount,
                      service_charge, gst, total, status, paid_amount, paid_on, notes
site_expenses         id, site_id, month, head, amount, note
work_orders           id, client_name, wo_number, wo_date, title, scope, site_id null, value,
                      start_date, end_date, extension_until, security_deposit, bg_expiry, dlp_months,
                      payment_terms, file_path null, status
projects              id, client, title, location, city, state, period_text, description,
                      image_slug, category, is_featured, sort_order
site_images           id, slug, url, local_path, alt_text, credit, is_stock bool, updated_at
tenders               id, source, tender_id, title, organisation, location, emd, estimated_value,
                      published_on, due_on, status, assigned_to, notes, url
openings              id, site_id, designation_id, category_id, vacancies, description, is_open
employee_documents    id, employee_id, type, file_path, expires_on null, uploaded_at
enquiries             id, name, phone, email, company, message, type, created_at, handled
job_applications      id, name, phone, email, city, position_applied, category_id, experience_years,
                      resume_path null, message, created_at, status
audit_log             id, actor_id, action, table_name, row_id, diff jsonb, at
```

### Storage discipline (the owner asked for this explicitly)

- Attendance lives as arrays in **one row per employee-month** (~200 bytes), never 31 rows. 160 employees × 12 months ≈ 2,000 rows a year.
- `payroll_lines` stores final numbers once as a snapshot, so a slip from three years ago regenerates without recomputation and survives every rule change.
- **PDFs and Excel files are generated in the browser and never uploaded.**
- Stock images live in `/public`, not Supabase Storage.
- Employee documents: compress images client-side to ≤ 200 KB JPEG before upload; PDFs ≤ 1 MB.
- Admin dashboard carries a **storage health card** (sum of `storage.objects.size` against the free-tier limit) and a one-click **"export everything to Excel"** so the owner is never locked in.

---

## 7. Site rules (per-site, versioned by `effective_from`)

The live sites use **different formulas**. Do not hard-code any of this — put it in `site_rules` and snapshot it into every payroll run.

| Rule | HMEL sites (WB-REF / ETP-REF, via Aquatech) | HZL Debari |
|---|---|---|
| Days used for pro-rating | actual calendar days | actual calendar days |
| OT divisor | 26 | 26 |
| OT multiplier | 2× of (full gross ÷ 26) per OT day | 2× of ((basic+da) ÷ 26) per OT day |
| Holiday-present (HP) multiplier | 1× of (full gross ÷ 26) | 2× of (full gross ÷ 26) |
| Night shift allowance | none | Rs 50 per night |
| OT hours → OT days | ÷ 8 | ÷ 8 |
| Employee PF | 12% of (gross − HRA), capped at ceiling 15,000 → max 1,800; ROUNDUP | 12% of (basic + da), **no ceiling**, Math.round |
| Employer PF | 13% of same base | 13% of same base |
| Employee ESI | 0.75% of (total earning + monthly bonus), only if monthly gross < 21,000 | same |
| Employer ESI | 3.25%, same base and condition | same |
| Labour Welfare Fund | employee Rs 5 / employer Rs 20 (Punjab) | Rs 5 / Rs 20 where applicable |
| Benevolent fund | none | Rs 100 employee deduction (HZL scheme) |
| Monthly statutory bonus | 8.33% of earned Basic(+DA), ROUNDUP, paid monthly | 0 monthly (accrue annually) |
| Professional tax | N/A (Punjab) — keep the field | N/A (Rajasthan) — keep the field |
| DA split of minimum wage | DA = 25% of total MW, Basic = remainder | Basic and DA entered separately |
| Leave accrual | CL 0.25/month + C-Off credits; EL 0.896/month + 0.064 × (P + HP) | configurable, default same |
| Rounding | ROUNDUP on every derived value | ROUNDUP on pro-rated components and totals; plain round on PF |

Expose all of it in a **Site Rules** form with current values pre-filled. Adding a fifth site must mean filling this form, not writing code.

---

## 8. Attendance

Day codes — one character per day in `day_codes`; show the long form in the UI:

| Code | Meaning | Payable day? |
|---|---|---|
| P | Present | yes |
| W | Weekly Off (WO) | yes |
| H | Paid Holiday | yes |
| Q | Holiday Present (HP) — worked a holiday | yes, and adds 1 HP day |
| O | On Duty (OD) | yes |
| L | Leave / PL / EL | yes |
| C | Casual Leave | yes |
| X | Absent | no (LOP) |

`payable_days = count(P,W,H,Q,O,L,C)` · `lop = days_in_month − payable_days` · `hp_days = count(Q)`

**Three entry paths, all landing in the same row:**

1. **Grid entry** — employees down, days 1..31 across, type a code, arrow keys move, paste from Excel works. Live row totals (P, H, HP, WO, L, CL, X, Total Payable) matching the company's "Attendance Format" sheet exactly.
2. **Quick entry** — just "days payable" and "OT hours" per employee, which is what the site supervisor actually WhatsApps. App fills P for those days, X for the rest.
3. **Import** — biometric/machine export (CSV/XLSX with emp_code, date, in, out, or a P/A matrix) **or** the company's own Attendance Format sheet. Show a mapping preview, flag unmatched employee codes, let HR fix before saving.

Separate tabs for **OT hours** (per day → Total Hours → OT days = hours ÷ 8; split General OT vs Holiday/Weekly-off OT) and **Extra Hours / C-Off** (excess hours count double, short hours subtract; CL hours = excess×2 + less; C-Off days = CL hours ÷ 8, credited to `leave_balances`). Plus an **OT Justification** list (date, employee, work description, hours, reason) — the client audits this, so make it exportable.

---

## 9. Payroll computation (the core — get this exactly right)

Inputs per employee per month: current `salary_structure`, the `attendance_months` row, the site rule snapshot, and manual fields (hold, leave encashment, deductions, mess bill, advance recovery).

Compute in this order, storing every intermediate value in `payroll_lines`:

```
full_gross      = basic + da + hra + conveyance + education + medical + other
factor          = payable_days / days_in_month
basic_e         = ROUNDUP(basic * factor)          -- each component pro-rated separately
da_e, hra_e, conveyance_e, education_e, medical_e, other_e   likewise
gross_earned    = sum of pro-rated components
ot_days         = ot_hours_total / 8
ot_amount       = ROUNDUP((ot_base / ot_divisor) * ot_days * ot_multiplier)
                  -- ot_base = full_gross or (basic+da), per site rule
hp_amount       = ROUNDUP((full_gross / ot_divisor) * hp_days * hp_multiplier)
night_amount    = night_shifts * night_shift_rate
total_earning   = gross_earned + ot_amount + hp_amount + night_amount
monthly_bonus   = rule.pay_bonus_monthly ? ROUNDUP(basic_e * 0.0833) : 0
annual_accrual  = rule.pay_bonus_monthly ? 0 : ROUNDUP(basic_e * 0.0833)
pf_base         = rule.pf_base == 'gross_minus_hra' ? gross_earned - hra_e : basic_e + da_e
pf_base         = rule.pf_ceiling ? min(pf_base, rule.pf_ceiling) : pf_base
pf_employee     = pf_applicable ? round_rule(pf_base * 0.12) : 0
pf_employer     = pf_applicable ? round_rule(pf_base * 0.13) : 0
esi_now         = esi_applicable && full_gross < 21000
esi_employee    = esi_now ? ROUNDUP((total_earning + monthly_bonus) * 0.0075) : 0
esi_employer    = esi_now ? ROUNDUP((total_earning + monthly_bonus) * 0.0325) : 0
lwf_employee, lwf_employer, benevolent_fund      from rules (0 if N/A)
total_deductions = pf_employee + esi_employee + lwf_employee + benevolent_fund + pt
                   + deduction_1 + deduction_2 + deduction_3 + mess_bill
                   + advance_recovery + hold_amount
net_salary      = total_earning + monthly_bonus + leave_encashment - total_deductions
ctc             = total_earning + monthly_bonus + annual_accrual + leave_encashment
                  + pf_employer + esi_employer + lwf_employer
ctc_for_billing = ctc - hold_amount
```

Also compute the **"General salary"** column set — what the person would earn at full attendance with zero OT — and show it alongside, because the company's sheet shows both and clients compare them.

### Acceptance tests (must pass to the rupee)

- **HZL Debari, Aug-2026, `ZSD0026611` SUNIL RAMESH SHARMA** — Basic 29,896 / DA 5,591 / HRA 1,000 / Conveyance 520 / Medical 1,000; 31 of 31 payable days; OT 8,440 → PF 4,258, Benevolent 100, Total earnings 46,447, Total deductions 4,358, **Net 42,089**.
- **HZL Debari, Aug-2026, `ZSD0026616` NARENDRA NAGAR** — Basic 17,325 / HRA 6,930 / Other 13,049; 31 of 31 days; OT 2,153 → PF 2,079, **Net 37,378** (words: "Thirty-Seven Thousand Three Hundred Seventy-Eight").

### Payroll screen flow

Pick site + month → **Create draft** (pulls structures + attendance) → Excel-like review grid in the same column order as the company's Working Salary sheet (Sl No, Emp No, Name, Designation, Category, DOJ, Basic, DA, Total MW, Days Payable, LOP, pro-rated components, Gross, OT days, HP days, OT amount, HP amount, Total Earning, PF 12%, ESIC 0.75%, WF, PF 13%, ESIC 3.25%, WF, Monthly Bonus, Annual Bonus, Leave Encashment, Net, Hold, CTC, CTC for billing) → only manual columns editable → totals row → **warnings** (Basic+DA below minimum wage, ESI crossed 21k, missing bank details, missing attendance) → **Finalize** (locks the run, writes audit log) → slips and exports unlock. Re-opening a final run creates version 2 and preserves version 1.

### Working-salary sheet import

The owner sometimes receives a ready Working Salary Excel from the client. Provide **Import working salary sheet**: detect the header row by fuzzy-matching known column names ("Basic + DA", "No.of Days Payable", "Total OT Amount", "Net Salary", "Hold Salary", "CTC for Current Billing"…), map rows by employee code in column A / "Register No." / "Emp. No.", **preview the differences against the app's own computation**, and let HR accept uploaded values per column or per row. Imported lines are stored with `source='import'`.

---

## 10. Salary slip (Form XIX) — PDF, two slips per A4 portrait page

Reproduce the existing layout exactly:

```
Vikram Engineering Co.
Sushant City - 2, Bathinda (Punjab) - 151001
Form XIX
Salary Slip for the Month of <Month-YYYY>

Emp Name  <NAME>                      Designation <DESIGNATION>
Emp No.   <code> - <sl no>            PF A/c. No. <pf>     ESIC No. <esi>
Location  <site location>             UAN No <uan>
Bank <bank>  Account No <acct>        LOP <n>  NDP <days present>  MOP Credit In Bank Account

EARNINGS                              DEDUCTION
Basic                    <>           Provident Fund (12%)        <>
DA                       <>           ESI                         <>
HRA                      <>           Professional Tax            <>
Conveyance Allowance     <>           Labour Welfare Fund         <>
Education Allowance      <>           Deduction ii                <>
Medical Allowance        <>           Deduction iii               <>
Other Allowance          <>           Benevolent Fund             <>
Statutory Bonus          <>           Mess Bill                   <>
Over Time & Holiday Payment <>
Total Earnings           <>           Total Deductions            <>

Net Salary <amount>   <amount in words, Indian numbering>

(Employee Signature)      (It is a Computer Generated Report and required no Signature)
```

Buttons: **Download all slips** (one PDF sorted by Sl No), **Download one**, **Download by category**. Header lines come from `sites`. Show zero rows unless the site rule says to hide them.

**Also generate from the same finalized run:** Form XVI Muster Roll · Form XVII Register of Wages · Form C Bonus register (annual) · **PF ECR text file** (EPFO format: `UAN#~#Name#~#Gross#~#EPF wages#~#EPS wages#~#EDLI wages#~#EPF contri#~#EPS contri#~#EPF-EPS diff#~#NCP days#~#refund`) · **ESIC monthly contribution Excel** (IP number, IP name, days, wages, reason code) · **bank NEFT bulk sheet** (name, account, IFSC, amount, narration `SAL <MON-YY>`) as a generic CSV that can be re-mapped per bank.

---

## 11. Employees module

- Excel-style grid per site and "All sites", inline edit, column chooser, XLSX export, XLSX import using the company's Master Sheet column names (CONT CODE, SUB CONT CODE, EMPLOYEE CODE, EMPLOYEE NAME, WORK ORDER NUMBER, DESIGNATION, CATEGORY, LOCATION, GENDER, DATE OF BIRTH, DATE OF JOINING, FATHER NAME, ESI NUMBER, UAN / PF ACCOUNT NUMBER, PFAPPLICABLE, ESIAPPLICABLE, BASIC, DA, HRA, MEDICAL ALLOWANCE, FIXED OTHER ALLOWANCE, CONVEYANCE ALLOWANCE, BANK NAME, BANK ACCOUNT NO., IFSC CODE, UAN NO.).
- Employee page: profile, current structure with full history, documents with expiry badges (gate pass, medical, safety training), month-by-month payslip list with download, leave balances, **transfer to another site** (closes structure at old site, opens at new), **mark exit** → Full & Final calculator (pending days, leave encashment, accrued bonus, deductions).
- Validation: IFSC format, UAN 12 digits, ESI 10/17 digits, numeric bank account, DOJ ≤ today, unique `emp_code` per site.
- Bulk actions: apply a new minimum wage to a whole category from a date (creates new structures, keeps old), and an **arrears calculator** for retrospective revisions.

---

## 12. Admin-only: billing, profit, reports

- **Billing rates** per site — service charge % on CTC-for-billing, or per-category day rate × payable days, or fixed monthly. GST default 18%.
- **Invoice draft** per site per month from the final run: basis, service charge, GST, total. Number series `VEC/<FY>/<seq>`. Mark sent / paid / partial. **Receivables ageing** 0-30, 31-60, 61-90, 90+.
- **Site expenses** ledger per month.
- **Profit** per site per month = invoice total (ex-GST) − Σ `ctc_for_billing` − site expenses. Alongside: headcount, average CTC, OT cost share, statutory cost share.
- **Admin dashboard** — cards for this month's payroll, billing, profit, receivables due, headcount by site. Graphs: monthly payroll vs billing per site (grouped bar), 12-month profit trend (line), payroll composition (donut: basic+DA / allowances / OT / employer statutory), headcount by category (bar). One chart per row, big readable labels, no gradients, no 3-D. Site selector: "All sites" or one site.
- **Reports** (all Excel): monthly payroll register, statutory summary, OT report with justifications, attendance summary, employee master, invoice register, expiring documents, work orders expiring within 90 days.
- **Audit log** viewer.

**HR dashboard** = same layout minus every money-out and profit card: attendance completion per site, payroll status per site, pending documents, pending applications and enquiries.

---

## 13. Work orders and tenders

- **Work orders**: list with client, WO number, value, start/end/extension, BG and security-deposit expiry, status. Alerts at 90/60/30 days before end or BG expiry. Optional scanned PDF attachment. Link to the site it feeds.
- **Tender tracker**: Kanban (Identified → Preparing → Submitted → Won / Lost / Dropped) with due-date colouring. Plus a **Target list** page of portals to watch — GeM, CPPP (eprocure.gov.in), HMEL vendor portal, HZL/Vedanta contractor portal, EIL, IOCL/BPCL/HPCL e-tender, state PHED and Jal Nigam STP O&M tenders (Punjab, Rajasthan, Haryana, UP) — with saved keywords (ETP O&M, STP O&M, manpower supply, housekeeping, RO plant O&M, mechanical erection, water treatment O&M). Phase 1 is manual entry with reminders; a later phase may poll CPPP/GeM RSS for those keywords.
- **Capability statement PDF generator** — company profile, project list from §3, manpower strength, trades covered, statutory registrations — for attaching to bids. This is the single highest-leverage feature for winning work; make it one click.

---

## 14. Public website (no login)

Pages:

- **Home** — full-bleed hero (`hero-refinery-night`) with the positioning line *"We run the plants that keep refineries running."* and sub-line *"Since 2015 — O&M of water, effluent and RO-DM plants, skilled manpower and mechanical contracting for HMEL, Hindustan Zinc, Engineers India Ltd and SUEZ."* Then: stats strip (11+ years · 160+ workers on roll · 9 clients · 3 states) · six service tiles with the images from §4 · client list · two featured projects · CTA buttons "Enquire" and "Apply for a job".
- **Services** — the six service lines from §2, each with its image, a plain-English description, and the projects that prove it.
- **Projects & Clients** — cards from `projects`, filterable by client, category and location. Live sites shown separately from completed work. A simple list of cities (Bathinda, Udaipur, Sriganganagar, Jhansi) — no interactive map in phase 1.
- **About** — proprietor, since-year, the eight-year HMEL continuity story, and statutory registrations (GST, EPF, ESIC, Labour Licence) rendered **only if those fields are filled in settings**, so nothing shows blank.
- **Compliance** — the statutory list: Labour Licence under CLRA, PF and ESI with monthly challans and returns, minimum wages revised on notification, statutory bonus and leave salary, Employee Compensation policy, **salary by bank transfer by the 7th regardless of client payment**, Form XIX slips to every worker, HSSE and PPE compliance. This page is what a procurement officer reads before shortlisting.
- **Careers** — open positions from `openings` by site and category; application form with resume upload ≤ 2 MB PDF. Add a **Hindi/Punjabi toggle on this page only** — workers apply from phones and often don't read English.
- **Contact / Enquiry** — form with type (general enquiry / tender invitation / vendor registration), plus office address, email, phone.

Public forms post through a Next.js route handler: server-side Zod validation, IP rate limit, honeypot field, then insert + email notification to the office (Resend free tier or Supabase SMTP). Mobile-first, SEO meta tags, `sitemap.xml`, `robots.txt`, JSON-LD `Organization` schema. No animation beyond hover states.

---

## 15. Non-functional requirements

- Works on a 1366×768 laptop and on a phone — attendance quick entry and slip download especially.
- All lists paginate server-side; the payroll grid is virtualised.
- Every destructive or money-affecting action confirms and writes to `audit_log`.
- Migrations via Supabase CLI in `/supabase/migrations`. `/supabase/seed.sql` seeds the four sites, their rules, categories, the full designation list, minimum wages for Punjab and Rajasthan, the project list from §3, the image manifest from §4, and three sample employees per site (fake names, real structures).
- `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never imported into a client component), `RESEND_API_KEY`.
- **Vitest** tests for the payroll calculator covering both rule sets and both acceptance employees above, plus a golden-file test that renders a slip PDF and asserts its text content.
- README covering: Supabase project setup (create → migrate → seed → create first admin), Vercel deploy, and the **monthly HR runbook** — enter attendance → create draft → review warnings → finalize → download slips → download PF ECR and ESIC files → download bank sheet → raise invoice.

---

## 16. Build phases (demo after each)

1. **Foundation** — Next.js + Supabase auth, roles, RLS, sites, Site Rules form, categories/designations/minimum wages, employee CRUD + grid + Excel import/export, seed data. *Check:* HR sees only assigned sites; admin sees all four.
2. **Attendance + OT + C-Off** — grid, quick entry, import with mapping, justification list, leave balances. *Check:* totals match the Attendance Format sheet for a pasted month.
3. **Payroll engine + review grid + finalize + Form XIX slips.** *Check:* both acceptance employees match to the rupee; a 78-employee site renders the combined slip PDF in under 5 seconds in the browser.
4. **Working-salary import, statutory outputs (Form XVI/XVII, PF ECR, ESIC, bank sheet), employee documents, F&F.**
5. **Admin — billing rates, invoices, expenses, profit dashboard, reports, audit log, user management.**
6. **Work orders, tender tracker, capability statement PDF.**
7. **Public website** — all pages, image pipeline, enquiry and careers forms, email notifications, SEO.
8. **Polish** — mobile pass, empty and error states, storage health card, documented weekly `pg_dump` backup, README runbook.

---

**Start with Phase 1 now. Before writing any code, print the folder structure and the initial migration SQL for review, then proceed.**
