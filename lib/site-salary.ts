import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getRun } from "@/lib/codes";
import { saveEmployee } from "@/lib/employees";
import { parseSiteWorkbook, type SiteRow } from "@/lib/site-file";

/** A site row matched to the employee master (new people are added to the master on save). */
export type StoredSiteRow = SiteRow & { card: string; employeeId: number };

const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
/** The card used in the master: the site's code, or NEW-<UNIT>-<NAME> for people with no gate pass yet. */
export const cardFor = (unit: string, r: SiteRow) => (!r.code || /^new/i.test(r.code) ? `NEW-${unit}-${slug(r.name)}` : r.code.toUpperCase());

export async function previewSiteFile(unitCode: string, buf: Buffer) {
  const p = parseSiteWorkbook(buf);
  const cards = p.rows.map((r) => cardFor(unitCode, r));
  const known = cards.length ? (await db().execute(sql`SELECT c.card_no, e.id, e.name, u.code AS unit FROM employee_cards c JOIN employees e ON e.id = c.employee_id
    LEFT JOIN LATERAL (SELECT a.unit_id FROM assignments a WHERE a.employee_id = e.id AND a.valid_to IS NULL LIMIT 1) a ON true LEFT JOIN units u ON u.id = a.unit_id
    WHERE c.valid_to IS NULL AND c.card_no IN (${sql.join(cards.map((c) => sql`${c}`), sql`, `)})`)) as unknown as { card_no: string; id: number; name: string; unit: string | null }[] : [];
  const by = new Map(known.map((k) => [k.card_no, k]));
  const people = p.rows.map((r, i) => ({ ...r, card: cards[i], match: by.get(cards[i]) ?? null }));
  const otherUnit = people.filter((x) => x.match && x.match.unit && x.match.unit !== unitCode);
  if (otherUnit.length) p.warnings.push(`${otherUnit.length} already belong to another unit in the master (${otherUnit.map((x) => `${x.name} → ${x.match!.unit}`).join(", ")}).`);
  return { ...p, people };
}

/** Save the month's site file: new people go into the master (card, unit, designation), the rows are stored for the run. */
export async function saveSiteFile(unitCode: string, year: number, month: number, fileName: string, buf: Buffer, actor: string): Promise<{ error?: string; added?: number; rows?: number }> {
  const d = db();
  const [unit] = await d.select().from(schema.units).where(eq(schema.units.code, unitCode));
  if (!unit || unit.mode !== "file") return { error: "Choose a unit that is paid from a site file." };
  const run = await getRun(unit.id, unit.siteId, year, month, actor);
  if (run.status !== "draft") return { error: `${unitCode} ${month}/${year} is ${run.status} — reopen it before replacing the file.` };
  let pv;
  try { pv = await previewSiteFile(unitCode, buf); } catch (e) { return { error: e instanceof Error ? e.message : "The file could not be read." }; }
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  let added = 0;
  const rows: StoredSiteRow[] = [];
  for (const x of pv.people) {
    let id = x.match?.id;
    const info = x.info ?? {};
    if (!id) {
      id = (await saveEmployee(null, { name: x.name, cardNo: x.card, unitCode, designation: x.designation ?? undefined, category: x.category ?? undefined, doj: x.doj ?? undefined,
        effectiveFrom: x.doj && x.doj > first ? x.doj : first, ...info })).id;
      added++;
    } else {
      // details from the site's Master Sheet only fill gaps — the office's own entries are never overwritten
      const [e] = await d.select().from(schema.employees).where(eq(schema.employees.id, id));
      const gaps: Record<string, string> = {};
      const fill = (k: keyof typeof info, has: unknown) => { if (info[k] && !has) gaps[k] = info[k]!; };
      fill("dob", e.dob); fill("fatherName", e.fatherName); fill("gender", e.gender); fill("esicIp", e.esicIp); fill("uan", e.uan); fill("pfAccount", e.pfAccount);
      fill("bankName", e.bankName); fill("account", e.accountEnc); fill("ifsc", e.ifsc);
      if (Object.keys(gaps).length) await saveEmployee(id, gaps);
    }
    const { match: _m, ...row } = x;
    rows.push({ ...row, employeeId: id });
  }
  const values = { runId: run.id, fileName, file: buf, rows, warnings: pv.warnings, uploadedBy: actor, uploadedAt: new Date() };
  await d.insert(schema.siteSalaryFiles).values(values).onConflictDoUpdate({ target: schema.siteSalaryFiles.runId, set: values });
  return { added, rows: rows.length };
}

export async function siteFileOf(runId: number) {
  const [f] = await db().select({ fileName: schema.siteSalaryFiles.fileName, rows: schema.siteSalaryFiles.rows, warnings: schema.siteSalaryFiles.warnings, uploadedAt: schema.siteSalaryFiles.uploadedAt, uploadedBy: schema.siteSalaryFiles.uploadedBy })
    .from(schema.siteSalaryFiles).where(eq(schema.siteSalaryFiles.runId, runId));
  return f ? { ...f, rows: f.rows as StoredSiteRow[], warnings: f.warnings as string[] } : null;
}
