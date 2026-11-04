import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decrypt, sealed } from "@/lib/crypto";

const { employees, employeeCards, assignments, payStructures, units, sites, minWages, auditLog } = schema;

export const CATEGORIES = ["UNSKILLED", "SEMI SKILLED", "SKILLED", "HIGH SKILLED"] as const;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const today = () => new Date().toISOString().slice(0, 10);

export type ListRow = {
  id: number; vecId: string; name: string; status: string; mobile: string | null; uan: string | null;
  accountLast4: string | null; ifsc: string | null; doj: string | null;
  cardNo: string | null; unitCode: string | null; siteName: string | null; designation: string | null; category: string | null;
};

export type ListFilter = { q?: string; unit?: string; status?: string; missing?: string; page?: number; size?: number };

/** Directory query: current card, assignment and unit for each person. */
export async function listEmployees(f: ListFilter) {
  const size = f.size ?? 25, page = Math.max(1, f.page ?? 1);
  const q = (f.q ?? "").trim();
  const where = [sql`true`];
  if (q) {
    const like = `%${q}%`;
    where.push(sql`(e.name ILIKE ${like} OR e.vec_id ILIKE ${like} OR e.uan ILIKE ${like} OR e.mobile ILIKE ${like}
      OR EXISTS (SELECT 1 FROM employee_cards c2 WHERE c2.employee_id = e.id AND c2.card_no ILIKE ${like}))`);
  }
  if (f.unit) where.push(sql`u.code = ${f.unit}`);
  if (f.status && f.status !== "all") where.push(sql`e.status = ${f.status}`);
  if (f.missing === "bank") where.push(sql`(e.account_enc IS NULL OR e.ifsc IS NULL)`);
  if (f.missing === "uan") where.push(sql`(e.pf_member AND e.uan IS NULL)`);
  if (f.missing === "aadhaar") where.push(sql`e.aadhaar_enc IS NULL`);
  if (f.missing === "dob") where.push(sql`e.dob IS NULL`);
  const cond = sql.join(where, sql` AND `);
  const base = sql`FROM employees e
    LEFT JOIN LATERAL (SELECT * FROM assignments a WHERE a.employee_id = e.id AND a.valid_to IS NULL ORDER BY a.valid_from DESC LIMIT 1) a ON true
    LEFT JOIN units u ON u.id = a.unit_id
    LEFT JOIN sites s ON s.id = u.site_id
    LEFT JOIN LATERAL (SELECT card_no FROM employee_cards c WHERE c.employee_id = e.id AND c.valid_to IS NULL ORDER BY c.valid_from DESC LIMIT 1) c ON true
    WHERE ${cond}`;
  const d = db();
  const rows = await d.execute(sql`SELECT e.id, e.vec_id AS "vecId", e.name, e.status, e.mobile, e.uan, e.account_last4 AS "accountLast4",
      e.ifsc, e.doj::text AS doj, c.card_no AS "cardNo", u.code AS "unitCode", s.name AS "siteName", a.designation, a.category
    ${base} ORDER BY u.sort_order NULLS LAST, NULLIF(regexp_replace(a.register_no, '\\D', '', 'g'), '')::int NULLS LAST, e.name LIMIT ${size} OFFSET ${(page - 1) * size}`);
  const [{ n }] = (await d.execute(sql`SELECT count(*)::int AS n ${base}`)) as unknown as { n: number }[];
  return { rows: rows as unknown as ListRow[], total: n, page, size };
}

/** Active employees without a date of birth — they cannot open the worker page (card no. + date of birth). */
export async function noDobCount() {
  const [{ n }] = (await db().execute(sql`SELECT count(*)::int AS n FROM employees WHERE status = 'active' AND dob IS NULL`)) as unknown as { n: number }[];
  return n;
}

export async function statusCounts() {
  const rows = (await db().execute(sql`SELECT status, count(*)::int AS n FROM employees GROUP BY status`)) as unknown as { status: string; n: number }[];
  const m = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  return { all: rows.reduce((a, r) => a + r.n, 0), active: m.active ?? 0, left: m.left ?? 0, on_hold: m.on_hold ?? 0 };
}

export async function unitList() {
  return db().select({ id: units.id, code: units.code, name: units.name, siteName: sites.name, siteState: sites.state, workOrders: units.workOrders, mode: units.mode })
    .from(units).innerJoin(sites, eq(sites.id, units.siteId)).orderBy(asc(units.sortOrder));
}

/** Per-unit headcount and data gaps for the dashboard. */
export async function unitSummary() {
  return (await db().execute(sql`SELECT u.code, u.name, s.name AS site, u.mode,
      count(e.id) FILTER (WHERE e.status = 'active')::int AS active,
      count(e.id) FILTER (WHERE e.status = 'active' AND (e.account_enc IS NULL OR e.ifsc IS NULL))::int AS "noBank",
      count(e.id) FILTER (WHERE e.status = 'active' AND e.pf_member AND e.uan IS NULL)::int AS "noUan",
      count(e.id) FILTER (WHERE e.status = 'active' AND e.aadhaar_enc IS NULL)::int AS "noAadhaar"
    FROM units u JOIN sites s ON s.id = u.site_id
    LEFT JOIN assignments a ON a.unit_id = u.id AND a.valid_to IS NULL
    LEFT JOIN employees e ON e.id = a.employee_id
    GROUP BY u.id, s.name ORDER BY u.sort_order`)) as unknown as { code: string; name: string; site: string; mode: string; active: number; noBank: number; noUan: number; noAadhaar: number }[];
}

export async function recentActivity(limit = 8) {
  return db().select().from(auditLog).orderBy(desc(auditLog.at)).limit(limit);
}

export async function getEmployee(id: number) {
  const d = db();
  const [e] = await d.select().from(employees).where(eq(employees.id, id));
  if (!e) return null;
  const cards = await d.select({ id: employeeCards.id, cardNo: employeeCards.cardNo, validFrom: employeeCards.validFrom, validTo: employeeCards.validTo, unitCode: units.code })
    .from(employeeCards).leftJoin(units, eq(units.id, employeeCards.unitId)).where(eq(employeeCards.employeeId, id)).orderBy(desc(employeeCards.validFrom));
  const assigns = await d.select({ id: assignments.id, unitCode: units.code, unitName: units.name, siteName: sites.name, siteState: sites.state, registerNo: assignments.registerNo,
      designation: assignments.designation, category: assignments.category, woWeekday: assignments.woWeekday, isDriver: assignments.isDriver, validFrom: assignments.validFrom, validTo: assignments.validTo })
    .from(assignments).innerJoin(units, eq(units.id, assignments.unitId)).innerJoin(sites, eq(sites.id, units.siteId))
    .where(eq(assignments.employeeId, id)).orderBy(desc(assignments.validFrom));
  const pays = await d.select().from(payStructures).where(eq(payStructures.employeeId, id)).orderBy(desc(payStructures.effectiveFrom));
  const history = await d.select().from(auditLog).where(and(eq(auditLog.entity, "employee"), eq(auditLog.entityId, String(id)))).orderBy(desc(auditLog.at)).limit(50);
  const current = assigns.find((a) => !a.validTo) ?? null;
  let minWage: number | null = null;
  if (current?.category) {
    const [mw] = await d.select().from(minWages).where(and(eq(minWages.state, current.siteState), eq(minWages.category, current.category)))
      .orderBy(desc(minWages.effectiveFrom)).limit(1);
    minWage = mw?.monthlyRate ?? null;
  }
  return { e, cards, assigns, current, pays, pay: pays[0] ?? null, history, minWage, card: cards.find((c) => !c.validTo) ?? null };
}

export function revealValue(e: { aadhaarEnc: string | null; panEnc: string | null; accountEnc: string | null }, field: "aadhaar" | "pan" | "account") {
  const v = field === "aadhaar" ? e.aadhaarEnc : field === "pan" ? e.panEnc : e.accountEnc;
  return v ? decrypt(v) : null;
}

export async function nextVecId(): Promise<string> {
  const [{ m }] = (await db().execute(sql`SELECT coalesce(max(substring(vec_id from 4)::int), 0) AS m FROM employees`)) as unknown as { m: number }[];
  return "VEC" + String(Number(m) + 1).padStart(6, "0");
}

export async function findByCard(cardNo: string) {
  const [r] = await db().select({ employeeId: employeeCards.employeeId }).from(employeeCards)
    .where(and(eq(employeeCards.cardNo, cardNo), isNull(employeeCards.validTo)));
  return r?.employeeId ?? null;
}

/** Fields an office user can set on a person. Undefined = leave unchanged; "" = clear. */
export type EmployeeInput = {
  name?: string; fatherName?: string; dob?: string; gender?: string; mobile?: string; address?: string;
  aadhaar?: string; pan?: string; uan?: string; pfAccount?: string; esicIp?: string;
  pfMember?: boolean; esiMember?: boolean; bonusMonthly?: boolean;
  bankName?: string; account?: string; ifsc?: string; status?: string; doj?: string; dol?: string; notes?: string;
  cardNo?: string; unitCode?: string; registerNo?: string; designation?: string; category?: string; woWeekday?: string; isDriver?: boolean;
  basicDa?: number; hra?: number; special?: number; conveyance?: number; others?: number;
  effectiveFrom?: string; // date the new card / assignment / structure applies from
  structureFrom?: string; // optional separate date for the pay structure (imports: the month's first day)
};

const blank = (v: string | undefined) => (v === undefined ? undefined : v.trim() === "" ? null : v.trim());
const dayBefore = (d: string) => new Date(new Date(d + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);

/**
 * Create or update one person, closing and opening dated rows when the card, unit or
 * structure changes. Returns the employee id and a list of what changed (for the audit log).
 */
export async function saveEmployee(id: number | null, x: EmployeeInput): Promise<{ id: number; changes: string[] }> {
  const d = db();
  return d.transaction(async (tx) => {
    const changes: string[] = [];
    // new person: card and unit start on the joining date; later changes start on the given date or today
    const from = x.effectiveFrom || (id === null ? x.doj : undefined) || today();
    const structureFrom = x.structureFrom || from;
    const core: Partial<typeof employees.$inferInsert> = {};
    const set = <K extends keyof typeof employees.$inferInsert>(k: K, v: (typeof employees.$inferInsert)[K] | undefined) => {
      if (v !== undefined) core[k] = v;
    };
    set("name", x.name?.trim().toUpperCase() || undefined);
    set("fatherName", blank(x.fatherName));
    set("dob", blank(x.dob));
    set("gender", blank(x.gender));
    set("mobile", blank(x.mobile));
    set("address", blank(x.address));
    set("uan", blank(x.uan));
    set("pfAccount", blank(x.pfAccount));
    set("esicIp", blank(x.esicIp));
    set("pfMember", x.pfMember);
    set("esiMember", x.esiMember);
    set("bonusMonthly", x.bonusMonthly);
    set("bankName", blank(x.bankName)?.toUpperCase() ?? (x.bankName === undefined ? undefined : null));
    set("ifsc", blank(x.ifsc)?.toUpperCase() ?? (x.ifsc === undefined ? undefined : null));
    set("status", x.status || undefined);
    set("doj", blank(x.doj));
    set("dol", blank(x.dol));
    set("notes", blank(x.notes));
    if (x.aadhaar !== undefined) { const s = sealed(x.aadhaar); core.aadhaarEnc = s.enc; core.aadhaarLast4 = s.last4; }
    if (x.pan !== undefined) { const s = sealed(x.pan?.toUpperCase()); core.panEnc = s.enc; core.panLast4 = s.last4; }
    if (x.account !== undefined) { const s = sealed(x.account); core.accountEnc = s.enc; core.accountLast4 = s.last4; }

    let empId = id;
    if (empId === null) {
      if (!core.name) throw new Error("Name is required");
      const [{ m }] = (await tx.execute(sql`SELECT coalesce(max(substring(vec_id from 4)::int), 0) AS m FROM employees`)) as unknown as { m: number }[];
      const vecId = "VEC" + String(Number(m) + 1).padStart(6, "0");
      const [row] = await tx.insert(employees).values({ ...(core as typeof employees.$inferInsert), name: core.name, vecId }).returning({ id: employees.id });
      empId = row.id;
      changes.push(`created ${vecId}`);
    } else if (Object.keys(core).length) {
      const [old] = await tx.select().from(employees).where(eq(employees.id, empId));
      for (const [k, v] of Object.entries(core)) {
        const before = (old as Record<string, unknown>)[k];
        if (String(before ?? "") !== String(v ?? "")) changes.push(k.endsWith("Enc") ? `${k.replace("Enc", "")} changed` : `${k}: ${before ?? "—"} → ${v ?? "—"}`);
      }
      await tx.update(employees).set({ ...core, updatedAt: new Date() }).where(eq(employees.id, empId));
    }

    let unitId: number | null = null;
    if (x.unitCode) {
      const [u] = await tx.select({ id: units.id }).from(units).where(eq(units.code, x.unitCode));
      if (!u) throw new Error(`Unknown unit ${x.unitCode}`);
      unitId = u.id;
    }

    // card: a new number closes the current one the day before
    const card = blank(x.cardNo);
    if (card) {
      const [cur] = await tx.select().from(employeeCards).where(and(eq(employeeCards.employeeId, empId), isNull(employeeCards.validTo)));
      if (!cur || cur.cardNo !== card) {
        const [taken] = await tx.select({ e: employeeCards.employeeId }).from(employeeCards).where(and(eq(employeeCards.cardNo, card), isNull(employeeCards.validTo)));
        if (taken && taken.e !== empId) throw new Error(`Card ${card} is already linked to another employee`);
        if (cur) await tx.update(employeeCards).set({ validTo: dayBefore(from) }).where(eq(employeeCards.id, cur.id));
        await tx.insert(employeeCards).values({ employeeId: empId, cardNo: card, unitId, validFrom: from });
        changes.push(`card ${cur?.cardNo ?? "—"} → ${card} from ${from}`);
      }
    }

    // assignment: unit / designation / category / weekly off / register no.
    if (unitId !== null) {
      const [cur] = await tx.select().from(assignments).where(and(eq(assignments.employeeId, empId), isNull(assignments.validTo)));
      const next = {
        unitId, registerNo: blank(x.registerNo) ?? cur?.registerNo ?? null, designation: blank(x.designation)?.toUpperCase() ?? cur?.designation ?? null,
        category: blank(x.category) ?? cur?.category ?? null, woWeekday: blank(x.woWeekday) ?? cur?.woWeekday ?? null, isDriver: x.isDriver ?? cur?.isDriver ?? false,
      };
      const same = cur && cur.unitId === next.unitId && cur.registerNo === next.registerNo && cur.designation === next.designation
        && cur.category === next.category && cur.woWeekday === next.woWeekday && cur.isDriver === next.isDriver;
      if (!same) {
        if (cur && cur.unitId !== unitId) {
          await tx.update(assignments).set({ validTo: dayBefore(from) }).where(eq(assignments.id, cur.id));
          await tx.insert(assignments).values({ employeeId: empId, ...next, validFrom: from });
          changes.push(`transferred to ${x.unitCode} from ${from}`);
        } else if (cur) {
          await tx.update(assignments).set(next).where(eq(assignments.id, cur.id));
          changes.push("job details updated");
        } else {
          await tx.insert(assignments).values({ employeeId: empId, ...next, validFrom: from });
          changes.push(`assigned to ${x.unitCode}`);
        }
      }
    }

    // pay structure: a different amount starts a new dated structure
    if (x.basicDa !== undefined && x.basicDa > 0) {
      const next = { basicDa: x.basicDa, hra: x.hra ?? 0, special: x.special ?? 0, conveyance: x.conveyance ?? 0, others: x.others ?? 0 };
      const [cur] = await tx.select().from(payStructures).where(eq(payStructures.employeeId, empId)).orderBy(desc(payStructures.effectiveFrom)).limit(1);
      const same = cur && cur.basicDa === next.basicDa && cur.hra === next.hra && cur.special === next.special && cur.conveyance === next.conveyance && cur.others === next.others;
      if (!same) {
        await tx.insert(payStructures).values({ employeeId: empId, effectiveFrom: structureFrom, ...next })
          .onConflictDoUpdate({ target: [payStructures.employeeId, payStructures.effectiveFrom], set: next });
        changes.push(`structure from ${structureFrom}: Basic+DA ${next.basicDa}, HRA ${next.hra}`);
      }
    }
    return { id: empId, changes };
  });
}
