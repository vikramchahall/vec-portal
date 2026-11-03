import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Office login without a login service (BRD-01 14.1): 2–3 fixed accounts in
 * /opt/vec/shared/office-users.json on the server, passwords bcrypt-hashed.
 * Add or change one with tools/office-user.mjs. 5 wrong tries lock the email
 * for 15 minutes. Sessions are an HMAC-signed cookie valid for 8 hours.
 *
 * Every page and server action calls requireUser() itself — layouts are not
 * re-run on every navigation, so they cannot be the only check.
 */
export type Role = "owner" | "hr";
export type OfficeUser = { email: string; name: string; role: Role; hash: string };
export type SessionUser = { email: string; name: string; role: Role };

const COOKIE = "vec_session";
const MAX_AGE = 8 * 60 * 60;
const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

function usersFile() {
  return process.env.OFFICE_USERS_FILE ?? "/opt/vec/shared/office-users.json";
}

export function officeUsers(): OfficeUser[] {
  try {
    return JSON.parse(readFileSync(usersFile(), "utf8")) as OfficeUser[];
  } catch {
    return [];
  }
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is not set");
  return s;
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

function issue(u: SessionUser): string {
  const body = Buffer.from(JSON.stringify({ ...u, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verify(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    // the account must still exist with the same role (removing it from the file ends the session)
    const u = officeUsers().find((x) => x.email === p.email);
    return u && u.role === p.role ? { email: u.email, name: u.name, role: u.role } : null;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}

export async function requireUser(role?: Role): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect("/portal?denied=1");
  return u;
}

export type LoginResult = { ok: true } | { ok: false; message: string };
let dummyHash: string | undefined;

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const d = db();
  const [att] = await d.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
  if (att?.lockedUntil && att.lockedUntil > new Date()) {
    const mins = Math.ceil((att.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, message: `Too many wrong tries. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` };
  }
  const user = officeUsers().find((u) => u.email.toLowerCase() === email);
  // compare against a dummy hash when the email is unknown, so timing does not reveal valid emails
  dummyHash ??= bcrypt.hashSync("not-a-real-password", 10);
  const good = await bcrypt.compare(password, user?.hash ?? dummyHash);
  if (!user || !good) {
    const failed = (att?.lockedUntil && att.lockedUntil <= new Date() ? 0 : att?.failed ?? 0) + 1;
    const lockedUntil = failed >= MAX_TRIES ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await d.insert(schema.loginAttempts).values({ email, failed, lockedUntil })
      .onConflictDoUpdate({ target: schema.loginAttempts.email, set: { failed, lockedUntil } });
    const left = MAX_TRIES - failed;
    return { ok: false, message: left > 0 ? `Wrong email or password. ${left} ${left === 1 ? "try" : "tries"} left before the account is locked for ${LOCK_MINUTES} minutes.` : `Account locked for ${LOCK_MINUTES} minutes.` };
  }
  await d.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
  (await cookies()).set(COOKIE, issue({ email: user.email, name: user.name, role: user.role }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
  await audit(user.email, "login", "session", null);
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function audit(actor: string, action: string, entity: string, entityId: string | number | null, detail?: unknown) {
  await db().insert(schema.auditLog).values({
    actor, action, entity, entityId: entityId === null ? null : String(entityId), detail: detail ?? null,
  });
}
