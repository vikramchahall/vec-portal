import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const DOC_KINDS: [string, string][] = [["aadhaar", "Aadhaar card"], ["pan", "PAN card"], ["bank", "Bank passbook / cheque"], ["photo", "Photo"], ["appointment", "Appointment letter"], ["other", "Other"]];
export const docLabel = (k: string) => DOC_KINDS.find(([x]) => x === k)?.[1] ?? k;
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
export const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** A person's documents, newest first (without the file itself). */
export async function documentsOf(employeeId: number) {
  const t = schema.employeeDocuments;
  return db().select({ id: t.id, kind: t.kind, fileName: t.fileName, mime: t.mime, bytes: t.bytes, note: t.note, uploadedBy: t.uploadedBy, uploadedAt: t.uploadedAt })
    .from(t).where(eq(t.employeeId, employeeId)).orderBy(desc(t.uploadedAt));
}

export async function documentFile(employeeId: number, id: number) {
  const t = schema.employeeDocuments;
  const [d] = await db().select().from(t).where(and(eq(t.id, id), eq(t.employeeId, employeeId)));
  return d ?? null;
}

/** Per person (active first): which kinds are on file — for the Employee Documents page. */
export async function documentMatrix(f: { unit?: string; missing?: string; q?: string }) {
  const where = [sql`true`];
  if (f.unit) where.push(sql`u.code = ${f.unit}`);
  if (f.q) where.push(sql`(e.name ILIKE ${`%${f.q}%`} OR c.card_no ILIKE ${`%${f.q}%`} OR e.vec_id ILIKE ${`%${f.q}%`})`);
  if (f.missing) where.push(sql`NOT EXISTS (SELECT 1 FROM employee_documents d WHERE d.employee_id = e.id AND d.kind = ${f.missing})`);
  return (await db().execute(sql`SELECT e.id, e.vec_id, e.name, e.status, u.code AS unit, c.card_no,
      coalesce((SELECT array_agg(DISTINCT d.kind) FROM employee_documents d WHERE d.employee_id = e.id), '{}') AS kinds,
      (SELECT count(*) FROM employee_documents d WHERE d.employee_id = e.id)::int AS files
    FROM employees e
    LEFT JOIN LATERAL (SELECT a.unit_id FROM assignments a WHERE a.employee_id = e.id ORDER BY a.valid_to IS NULL DESC, a.valid_from DESC LIMIT 1) a ON true
    LEFT JOIN units u ON u.id = a.unit_id
    LEFT JOIN LATERAL (SELECT card_no FROM employee_cards c WHERE c.employee_id = e.id ORDER BY c.valid_to IS NULL DESC, c.valid_from DESC LIMIT 1) c ON true
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY e.status = 'active' DESC, u.code NULLS LAST, e.name LIMIT 500`)) as unknown as { id: number; vec_id: string; name: string; status: string; unit: string | null; card_no: string | null; kinds: string[]; files: number }[];
}
