import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { buildDuties, type Duty, type Punch } from "@/lib/engine/duty";

export type TcPerson = {
  card: string; employeeId: number | null; vecId: string | null; name: string; designation: string | null; registerNo: string | null;
  known: boolean; duties: Duty[]; doj: string | null; woWeekday: string | null; status: string | null;
};
export type TcResult = {
  unit: { id: number; code: string; name: string; workOrders: string[]; siteId: number };
  year: number; month: number; days: number; people: TcPerson[];
  summary: { cards: number; known: number; unknown: number; missingPunch: number; late: number; coffNet: number; noPunchPeople: number; flagged: number };
};

const pad = (n: number) => String(n).padStart(2, "0");
export const monthBounds = (year: number, month: number) => {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { days, first: `${year}-${pad(month)}-01`, last: `${year}-${pad(month)}-${pad(days)}` };
};

/**
 * Everything the Time Compliance screen and file need for one unit and month.
 * People in the unit = employees assigned to it in the month (all their punches, any work order)
 * plus cards that are not in the master but punched on the unit's work orders.
 */
export async function timeCompliance(unitCode: string, year: number, month: number): Promise<TcResult | null> {
  const d = db();
  const [unit] = await d.select().from(schema.units).where(eq(schema.units.code, unitCode));
  if (!unit) return null;
  const { days, first, last } = monthBounds(year, month);
  // a night shift on the last day ends the next morning; a duty with no IN can belong to the day before the 1st
  const from = sql`(${first}::date - interval '1 day')`, to = sql`(${last}::date + interval '2 days')`;

  const assigned = (await d.execute(sql`SELECT DISTINCT ON (c.card_no) e.id, e.vec_id, e.name, a.designation, a.register_no, c.card_no, e.doj::text AS doj, a.wo_weekday, e.status
    FROM assignments a JOIN employees e ON e.id = a.employee_id
    JOIN employee_cards c ON c.employee_id = e.id AND c.valid_from <= ${last}::date AND (c.valid_to IS NULL OR c.valid_to >= ${first}::date)
    WHERE a.unit_id = ${unit.id} AND a.valid_from <= ${last}::date AND (a.valid_to IS NULL OR a.valid_to >= ${first}::date)
    ORDER BY c.card_no, a.valid_from DESC`)) as unknown as { id: number; vec_id: string; name: string; designation: string | null; register_no: string | null; card_no: string; doj: string | null; wo_weekday: string | null; status: string }[];

  const unknown = unit.workOrders.length ? (await d.execute(sql`SELECT p.card_no, max(p.name) AS name, max(p.designation) AS designation
    FROM punches p WHERE p.work_order IN (${sql.join(unit.workOrders.map((w) => sql`${w}`), sql`, `)})
      AND p.ts >= ${first}::date AND p.ts < (${last}::date + interval '1 day')
      AND NOT EXISTS (SELECT 1 FROM employee_cards c WHERE c.card_no = p.card_no)
    GROUP BY p.card_no`)) as unknown as { card_no: string; name: string | null; designation: string | null }[] : [];

  const cards = [...assigned.map((a) => a.card_no), ...unknown.map((u) => u.card_no)];
  const punchRows = cards.length ? (await d.execute(sql`SELECT card_no, ts::text AS ts, dir, access FROM punches
    WHERE card_no IN (${sql.join(cards.map((c) => sql`${c}`), sql`, `)}) AND ts >= ${from} AND ts < ${to} ORDER BY ts`)) as unknown as { card_no: string; ts: string; dir: "Entry" | "Exit"; access: string }[] : [];
  const byCard = new Map<string, Punch[]>();
  for (const p of punchRows) {
    if (!byCard.has(p.card_no)) byCard.set(p.card_no, []);
    byCard.get(p.card_no)!.push({ ts: p.ts.slice(0, 19), dir: p.dir, access: p.access });
  }

  const regNum = (r: string | null) => Number((r ?? "").replace(/\D/g, "")) || 9999;
  const people: TcPerson[] = [
    ...assigned.sort((a, b) => regNum(a.register_no) - regNum(b.register_no) || a.name.localeCompare(b.name)).map((a) => ({
      card: a.card_no, employeeId: a.id, vecId: a.vec_id, name: a.name, designation: a.designation, registerNo: a.register_no, known: true,
      doj: a.doj, woWeekday: a.wo_weekday, status: a.status,
      duties: buildDuties(byCard.get(a.card_no) ?? [], year, month),
    })),
    ...unknown.map((u) => ({
      card: u.card_no, employeeId: null, vecId: null, name: (u.name ?? "").toUpperCase(), designation: u.designation, registerNo: null, known: false,
      doj: null, woWeekday: null, status: null,
      duties: buildDuties(byCard.get(u.card_no) ?? [], year, month),
    })),
  ];
  const all = people.flatMap((p) => p.duties);
  return {
    unit: { id: unit.id, code: unit.code, name: unit.name, workOrders: unit.workOrders, siteId: unit.siteId }, year, month, days, people,
    summary: {
      cards: people.filter((p) => p.duties.length).length, known: people.filter((p) => p.known && p.duties.length).length, unknown: unknown.length,
      missingPunch: all.filter((x) => !x.inn || !x.out).length, late: all.filter((x) => x.late > 0).length,
      coffNet: all.reduce((s, x) => s + x.coff, 0), noPunchPeople: people.filter((p) => p.known && !p.duties.length).length,
      flagged: all.filter((x) => x.flags.length).length,
    },
  };
}

export async function punchFileList(limit = 30) {
  return db().select().from(schema.punchFiles).orderBy(desc(schema.punchFiles.uploadedAt)).limit(limit);
}

/** Months with punches, newest first, with counts per work order. */
export async function punchMonths() {
  return (await db().execute(sql`SELECT to_char(ts, 'YYYY-MM') AS month, work_order, count(*)::int AS n, count(DISTINCT card_no)::int AS cards
    FROM punches GROUP BY 1, 2 ORDER BY 1 DESC, 2`)) as unknown as { month: string; work_order: string; n: number; cards: number }[];
}
