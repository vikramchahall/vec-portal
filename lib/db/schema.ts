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
  pgTable, serial, integer, text, boolean, date, timestamp, jsonb, uniqueIndex, index,
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
