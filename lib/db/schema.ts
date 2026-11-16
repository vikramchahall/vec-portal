/**
 * Portal database (PostgreSQL on the Lightsail server).
 *
 * One employee master for every site. A person keeps one VEC ID for life;
 * gate cards, unit assignments and pay structures hang off it with dates,
 * because cards change on transfer and structures change with minimum wages.
 *
 * Aadhaar, PAN and bank account are stored encrypted (lib/crypto.ts) with a
 * last-4 copy for display. Money is whole rupees.
 */
import {
  customType, pgTable, serial, integer, text, boolean, date, timestamp, jsonb, uniqueIndex, index, numeric, primaryKey,
} from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  client: text("client"),
  state: text("state").notNull(),
  billingModel: text("billing_model").notNull(), // per_employee | percent_of_bill
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  workOrders: text("work_orders").array().notNull().default([]),
  mode: text("mode").notNull(), // punch | file
  sortOrder: integer("sort_order").notNull().default(0),
  // what VEC earns on the unit: per_employee = ₹ rate per person paid per month; percent = rate % on the salary cost (CTC for billing)
  billingModel: text("billing_model").notNull().default("per_employee"),
  billingRate: numeric("billing_rate", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  vecId: text("vec_id").notNull().unique(), // VEC000001
  name: text("name").notNull(),
  fatherName: text("father_name"),
  dob: date("dob"),
  gender: text("gender"),
  mobile: text("mobile"),
  address: text("address"),
  aadhaarEnc: text("aadhaar_enc"),
  aadhaarLast4: text("aadhaar_last4"),
  panEnc: text("pan_enc"),
  panLast4: text("pan_last4"),
  uan: text("uan"),
  pfAccount: text("pf_account"),
  esicIp: text("esic_ip"),
  pfMember: boolean("pf_member").notNull().default(true),
  esiMember: boolean("esi_member").notNull().default(false),
  bonusMonthly: boolean("bonus_monthly").notNull().default(true),
  bankName: text("bank_name"),
  accountEnc: text("account_enc"),
  accountLast4: text("account_last4"),
  ifsc: text("ifsc"),
  status: text("status").notNull().default("active"), // active | left | on_hold
  doj: date("doj"),
  dol: date("dol"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("employees_name_idx").on(t.name)]);

// Gate card / client employee code, valid for a date range. Punch files are matched through this.
export const employeeCards = pgTable("employee_cards", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  cardNo: text("card_no").notNull(),
  unitId: integer("unit_id").references(() => units.id),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
}, (t) => [uniqueIndex("employee_cards_card_from").on(t.cardNo, t.validFrom), index("employee_cards_emp").on(t.employeeId)]);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  unitId: integer("unit_id").notNull().references(() => units.id),
  registerNo: text("register_no"),
  designation: text("designation"),
  category: text("category"), // UNSKILLED | SEMI SKILLED | SKILLED | HIGH SKILLED
  woWeekday: text("wo_weekday"), // Mon..Sun
  isDriver: boolean("is_driver").notNull().default(false),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
}, (t) => [index("assignments_emp").on(t.employeeId), index("assignments_unit").on(t.unitId)]);

export const payStructures = pgTable("pay_structures", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  effectiveFrom: date("effective_from").notNull(),
  basicDa: integer("basic_da").notNull(),
  hra: integer("hra").notNull().default(0),
  special: integer("special").notNull().default(0),
  conveyance: integer("conveyance").notNull().default(0),
  others: integer("others").notNull().default(0),
}, (t) => [uniqueIndex("pay_structures_emp_from").on(t.employeeId, t.effectiveFrom)]);

export const minWages = pgTable("min_wages", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  category: text("category").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  dailyRate: integer("daily_rate").notNull(),
  monthlyRate: integer("monthly_rate").notNull(),
}, (t) => [uniqueIndex("min_wages_key").on(t.state, t.category, t.effectiveFrom)]);

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  detail: jsonb("detail"),
}, (t) => [index("audit_log_entity").on(t.entity, t.entityId)]);

export const loginAttempts = pgTable("login_attempts", {
  email: text("email").primaryKey(),
  failed: integer("failed").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// Raw gate punches (S2). One row per swipe; the daily In/Out format is stored as Entry / Exit pairs.
// The same swipe in two overlapping exports is stored once (unique index; the access result is part of the key,
// because a gate can log a denied and a granted swipe at the same second).
export const punchFiles = pgTable("punch_files", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  sha256: text("sha256").notNull().unique(),
  format: text("format").notNull(), // gate | daily
  month: text("month"), // YYYY-MM (most punches)
  rows: integer("rows").notNull().default(0),
  status: text("status").notNull().default("uploading"), // uploading | complete
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const punches = pgTable("punches", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => punchFiles.id, { onDelete: "cascade" }),
  cardNo: text("card_no").notNull(),
  ts: timestamp("ts", { mode: "string" }).notNull(), // local (IST) wall-clock time
  dir: text("dir").notNull(), // Entry | Exit
  access: text("access").notNull(),
  workOrder: text("work_order").notNull(),
  name: text("name"),
  designation: text("designation"),
}, (t) => [uniqueIndex("punches_swipe").on(t.cardNo, t.ts, t.dir, t.workOrder, t.access), index("punches_card_ts").on(t.cardNo, t.ts), index("punches_wo_ts").on(t.workOrder, t.ts)]);

// S3: one record per unit and month (holidays, status), office overrides of single day codes,
// and leave opening balances (from the imported files, later from the previous locked month).
export const monthRuns = pgTable("month_runs", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").notNull().references(() => units.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  holidays: integer("holidays").array().notNull().default([]),
  status: text("status").notNull().default("draft"), // draft | approved | locked
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("month_runs_unit_month").on(t.unitId, t.year, t.month)]);

export const dayOverrides = pgTable("day_overrides", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => monthRuns.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  day: integer("day").notNull(),
  code: text("code").notNull(), // P HP H WO X L CL OD, or NOPUNCH = ignore that day's punches (card issue)
  reason: text("reason").notNull(),
  actor: text("actor").notNull(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("day_overrides_key").on(t.runId, t.employeeId, t.day)]);

export const leaveOpening = pgTable("leave_opening", {
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  month: date("month").notNull(), // first day of the month the balance opens
  cl: numeric("cl", { precision: 12, scale: 6 }).notNull(),
  l: numeric("l", { precision: 12, scale: 6 }).notNull(),
  source: text("source").notNull(), // import | locked-month | manual
}, (t) => [primaryKey({ columns: [t.employeeId, t.month] })]);

// S4: entries the office makes for a person and month (as typed into the October sheets).
export const payAdjustments = pgTable("pay_adjustments", {
  runId: integer("run_id").notNull().references(() => monthRuns.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  otDays: numeric("ot_days", { precision: 8, scale: 4 }).notNull().default("0"), // OT sheet: paid at gross ÷ 26 × 2 per day
  hold: integer("hold").notNull().default(0),
  leaveEncashment: integer("leave_encashment").notNull().default(0),
  reason: text("reason").notNull(),
  actor: text("actor").notNull(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.runId, t.employeeId] })]);

// S5: the frozen copy of a locked month — codes, balances and salary per person, never recomputed.
export const runSnapshots = pgTable("run_snapshots", {
  runId: integer("run_id").notNull().references(() => monthRuns.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  data: jsonb("data").notNull(),
}, (t) => [primaryKey({ columns: [t.runId, t.employeeId] })]);

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// The unit's own Working Salary workbook (last month's file), used as the export template.
export const excelTemplates = pgTable("excel_templates", {
  unitId: integer("unit_id").primaryKey().references(() => units.id),
  fileName: text("file_name").notNull(),
  file: bytea("file").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

// File-mode units (STP, HZL): the site's own Working Salary workbook for the month, as uploaded, and the
// person rows read from it (codes, earnings, deductions, net) — the month's salary for that unit.
export const siteSalaryFiles = pgTable("site_salary_files", {
  runId: integer("run_id").primaryKey().references(() => monthRuns.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  file: bytea("file").notNull(),
  rows: jsonb("rows").notNull(),
  warnings: jsonb("warnings").notNull().default([]),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

// Website forms (contact / tender invite / vendor registration, and job applications) — read on Portal → Website enquiries.
export const enquiries = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("enquiry"), // enquiry | tender_invite | vendor_registration
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // new | replied | closed
  note: text("note"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("enquiries_created").on(t.createdAt)]);

export const jobApplications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city"),
  position: text("position").notNull(),
  experienceYears: integer("experience_years"),
  message: text("message"),
  status: text("status").notNull().default("new"), // new | called | shortlisted | not_suitable
  note: text("note"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("job_applications_created").on(t.createdAt)]);

// Compliance calendar: recurring obligations (owner-editable) and what was filed for each period.
export const complianceItems = pgTable("compliance_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authority: text("authority"), // EPFO, ESIC, Punjab Labour Dept …
  frequency: text("frequency").notNull(), // monthly | half_yearly | yearly
  dueDay: integer("due_day").notNull(), // day of the month it is due
  dueMonths: integer("due_months").array().notNull().default([]), // half-yearly / yearly: the months it falls in (1-12)
  period: text("period").notNull().default("previous month"), // what the filing covers, shown as text
  appliesTo: text("applies_to"), // e.g. "HMEL units (Punjab)"
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  trackFrom: date("track_from").notNull().defaultNow(), // dues before this day are not shown (filed before the portal kept them)
});

export const complianceDone = pgTable("compliance_done", {
  itemId: integer("item_id").notNull().references(() => complianceItems.id, { onDelete: "cascade" }),
  dueDate: date("due_date").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }).defaultNow().notNull(),
  doneBy: text("done_by").notNull(),
  reference: text("reference"), // challan / TRRN / acknowledgement no.
  note: text("note"),
}, (t) => [primaryKey({ columns: [t.itemId, t.dueDate] })]);

// Scanned papers per person (Aadhaar, PAN, passbook, photo, letters). The file is encrypted (lib/crypto encryptBytes).
export const employeeDocuments = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  kind: text("kind").notNull(), // aadhaar | pan | bank | photo | appointment | other
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  data: bytea("data").notNull(),
  note: text("note"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("employee_documents_emp").on(t.employeeId)]);

// Bill the client passed for a unit and month (entered by the office) — compared with the expected bill.
export const clientBills = pgTable("client_bills", {
  unitId: integer("unit_id").notNull().references(() => units.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  billNo: text("bill_no"),
  billDate: date("bill_date"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // amount passed by the client (before GST)
  passedOn: date("passed_on"),
  note: text("note"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.unitId, t.year, t.month] })]);
