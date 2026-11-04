import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { audit } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import type { PayRow } from "@/lib/payroll";
import { revive, type SerializedPerson } from "@/lib/codes";

/**
 * Worker view (BRD-01, MBD-01 S6): a worker signs in with the card number on their gate card and
 * their date of birth, and sees only their own LOCKED months — attendance, leave, salary, payslip.
 * Separate cookie from the office session; 30 minutes; 5 wrong tries lock that card for 15 minutes.
 */
export type WorkerSession = { employeeId: number; card: string; name: string };

const COOKIE = "vec_worker";
const MAX_AGE = 30 * 60;
const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is not set");
  return s;
}
// "worker:" keeps these tokens from ever passing as an office session (and the other way round)
const sign = (data: string) => createHmac("sha256", secret()).update("worker:" + data).digest("base64url");

export async function currentWorker(): Promise<WorkerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof p.exp === "number" && p.exp > Date.now() / 1000 ? { employeeId: p.employeeId, card: p.card, name: p.name } : null;
  } catch {
    return null;
  }
}

export async function requireWorker(): Promise<WorkerSession> {
  const w = await currentWorker();
  if (!w) redirect("/worker/login");
  return w;
}

export type WorkerLoginResult = { ok: true } | { ok: false; message: string };

export async function workerLogin(cardRaw: string, dob: string): Promise<WorkerLoginResult> {
  const card = cardRaw.replace(/\s/g, "");
  if (!/^[A-Za-z0-9-]{3,20}$/.test(card) || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, message: "Enter your card number and date of birth." };
  const key = `card:${card}`;
  const d = db();
  const [att] = await d.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.email, key));
  if (att?.lockedUntil && att.lockedUntil > new Date()) {
    const mins = Math.ceil((att.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, message: `Too many wrong tries. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` };
  }
  const [e] = (await d.execute(sql`SELECT e.id, e.name, e.dob::text AS dob FROM employee_cards c JOIN employees e ON e.id = c.employee_id
    WHERE c.card_no = ${card} ORDER BY c.valid_from DESC LIMIT 1`)) as unknown as { id: number; name: string; dob: string | null }[];
  if (e && !e.dob) return { ok: false, message: "Your date of birth is not in our records yet. Please ask the VEC office to add it." };
  if (!e || e.dob !== dob) {
    const failed = (att?.lockedUntil && att.lockedUntil <= new Date() ? 0 : att?.failed ?? 0) + 1;
    const lockedUntil = failed >= MAX_TRIES ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await d.insert(schema.loginAttempts).values({ email: key, failed, lockedUntil }).onConflictDoUpdate({ target: schema.loginAttempts.email, set: { failed, lockedUntil } });
    const left = MAX_TRIES - failed;
    return { ok: false, message: left > 0 ? `Card number and date of birth do not match. ${left} ${left === 1 ? "try" : "tries"} left.` : `Locked for ${LOCK_MINUTES} minutes.` };
  }
  await d.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, key));
  const body = Buffer.from(JSON.stringify({ employeeId: e.id, card, name: e.name, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
  await audit(`worker:${card}`, "login", "worker_session", e.id);
  return { ok: true };
}

export async function workerLogout() {
  (await cookies()).delete(COOKIE);
}

// ---------- the worker's own data (locked months only) ----------
export type WorkerMonth = { runId: number; year: number; month: number; unit: string; unitName: string; netAfterPt: number; payableDays: number; days: number };

export async function workerProfile(employeeId: number) {
  const [e] = (await db().execute(sql`SELECT e.vec_id, e.name, e.doj::text AS doj, e.uan, e.esic_ip, e.bank_name, e.account_last4, e.ifsc,
      u.code AS unit, u.name AS unit_name, a.designation, a.category
    FROM employees e
    LEFT JOIN LATERAL (SELECT * FROM assignments a WHERE a.employee_id = e.id ORDER BY a.valid_to IS NULL DESC, a.valid_from DESC LIMIT 1) a ON true
    LEFT JOIN units u ON u.id = a.unit_id WHERE e.id = ${employeeId}`)) as unknown as Record<string, string | null>[];
  return e ?? null;
}

export async function workerMonths(employeeId: number): Promise<WorkerMonth[]> {
  const rows = (await db().execute(sql`SELECT r.id, r.year, r.month, u.code, u.name, s.data->'line'->>'netAfterPt' AS net, s.data->'line'->>'payableDays' AS days
    FROM run_snapshots s JOIN month_runs r ON r.id = s.run_id JOIN units u ON u.id = r.unit_id
    WHERE s.employee_id = ${employeeId} AND r.status = 'locked' ORDER BY r.year DESC, r.month DESC`)) as unknown as Record<string, string | number>[];
  return rows.map((r) => ({ runId: Number(r.id), year: Number(r.year), month: Number(r.month), unit: String(r.code), unitName: String(r.name),
    netAfterPt: Number(r.net), payableDays: Number(r.days), days: new Date(Date.UTC(Number(r.year), Number(r.month), 0)).getUTCDate() }));
}

export async function workerMonth(employeeId: number, runId: number) {
  const [r] = (await db().execute(sql`SELECT r.year, r.month, r.holidays, u.code, u.name, u.work_orders, s.data FROM run_snapshots s
    JOIN month_runs r ON r.id = s.run_id JOIN units u ON u.id = r.unit_id
    WHERE s.employee_id = ${employeeId} AND s.run_id = ${runId} AND r.status = 'locked'`)) as unknown as { year: number; month: number; holidays: number[]; code: string; name: string; work_orders: string[]; data: Omit<PayRow, "p"> & { p: SerializedPerson } }[];
  if (!r) return null;
  const row: PayRow = { ...r.data, p: revive(r.data.p) };
  return { year: r.year, month: r.month, holidays: r.holidays, days: new Date(Date.UTC(r.year, r.month, 0)).getUTCDate(), unit: { code: r.code, name: r.name, workOrders: r.work_orders }, row };
}
