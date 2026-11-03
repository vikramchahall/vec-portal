import * as XLSX from "xlsx";
import { sql } from "drizzle-orm";
import { audit, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** Master Sheet in the same 11-column layout as the salary files (used by the Slips sheet). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const unit = new URL(req.url).searchParams.get("unit");
  const rows = (await db().execute(sql`SELECT c.card_no, e.name, a.designation, u.code AS unit, s.code AS site, e.esic_ip, e.pf_account, e.bank_name, e.account_enc, e.account_last4, e.ifsc, e.uan
    FROM employees e
    JOIN LATERAL (SELECT * FROM assignments a WHERE a.employee_id = e.id AND a.valid_to IS NULL LIMIT 1) a ON true
    JOIN units u ON u.id = a.unit_id JOIN sites s ON s.id = u.site_id
    LEFT JOIN LATERAL (SELECT card_no FROM employee_cards c WHERE c.employee_id = e.id AND c.valid_to IS NULL LIMIT 1) c ON true
    WHERE e.status = 'active' ${unit ? sql`AND u.code = ${unit}` : sql``}
    ORDER BY u.sort_order, NULLIF(regexp_replace(a.register_no, '\\D', '', 'g'), '')::int NULLS LAST, e.name`)) as unknown as Record<string, string | null>[];
  // full account numbers only for the owner; HR gets the masked number
  const full = user.role === "owner";
  const aoa: (string | number)[][] = [["Employee Code", "Sl. No.", "EMPLOYEE NAME", "DESIGNATION", "LOCATION", "ESI NUMBER", "PF ACCOUNT NUMBER", "BANK NAME", "BANK ACCOUNT NO.", "IFSC CODE", "UAN NO."]];
  rows.forEach((r, i) => aoa.push([
    r.card_no && /^\d+$/.test(r.card_no) ? Number(r.card_no) : r.card_no ?? "", i + 1, r.name ?? "", r.designation ?? "", `${r.unit},${r.site}`,
    r.esic_ip ?? "", r.pf_account ?? "", r.bank_name ?? "",
    r.account_enc ? (full ? decrypt(r.account_enc) : "XXXXXXXX" + r.account_last4) : "", r.ifsc ?? "", r.uan ?? "",
  ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [12, 6, 26, 22, 16, 14, 18, 26, 20, 14, 15].map((wch) => ({ wch }));
  // keep long numbers as text so Excel does not turn them into 1.23E+13
  for (let r = 1; r < aoa.length; r++) for (const c of [5, 8, 10]) {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (ws[ref]) ws[ref] = { t: "s", v: String(ws[ref].v) };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Master Sheet");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await audit(user.email, "export", "employees", unit, { rows: rows.length, fullAccounts: full });
  const name = `Master_Sheet_${unit ?? "ALL"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
