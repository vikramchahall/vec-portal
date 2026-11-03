/**
 * Reads the client's raw gate exports (sheet "Result", header in row 4):
 *  - gate format: one row per card swipe — Date, Time, Name, Designation, EmpNo, Access, Direction, WorkOrderNo
 *  - daily In/Out format (e.g. WO 300005834 REF M&I): one row per person per day — Employee No, Date, In, Out, Workorder No
 * The daily format is turned into Entry / Exit punches so the same engine applies.
 *
 * Runs in the browser (the 1 GB server never holds a whole workbook in memory) and in tests.
 */
import * as XLSX from "xlsx";

export type PunchRow = { card: string; ts: string; dir: "Entry" | "Exit"; access: string; wo: string; name: string; desig: string };
export type PunchParse = { format: "gate" | "daily"; rows: PunchRow[]; skipped: number; workOrders: Record<string, { cards: number; punches: number; denied: number }>; month: string | null };

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const str = (v: unknown) => String(v ?? "").trim();

/** "31-10-2026" + "21:58:54" -> "2026-10-31 21:58:54" (also accepts Excel serials). */
function stamp(date: unknown, time: unknown): string | null {
  let d: string | null = null;
  if (typeof date === "number") d = new Date(Math.round((date - 25569) * 86400000)).toISOString().slice(0, 10);
  else {
    const m = str(date).match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
    if (m) d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  let t: string | null = null;
  if (typeof time === "number") {
    const secs = Math.round((time % 1) * 86400);
    t = [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60].map((x) => String(x).padStart(2, "0")).join(":");
  } else {
    const m = str(time).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) t = `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
  }
  return d && t ? `${d} ${t}` : null;
}

const nextDay = (ts: string) => new Date(Date.parse(ts.replace(" ", "T") + "Z") + 86400000).toISOString().replace("T", " ").slice(0, 19);

export function parsePunchWorkbook(buf: ArrayBuffer | Uint8Array): PunchParse {
  const wb = XLSX.read(buf, { type: "array", cellDates: false, cellFormula: false, cellStyles: false, dense: true });
  const sheet = wb.SheetNames.find((n) => n.trim().toLowerCase() === "result");
  if (!sheet) throw new Error('No "Result" sheet — this does not look like a gate attendance export.');
  const g = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null }) as unknown[][];
  let h = -1;
  for (let r = 0; r < Math.min(10, g.length); r++) {
    const cells = (g[r] ?? []).map(norm);
    if (cells.includes("date") && (cells.includes("empno") || cells.includes("employee no"))) { h = r; break; }
  }
  if (h < 0) throw new Error("Header row (Date, EmpNo / Employee No) not found in the Result sheet.");
  const head = (g[h] ?? []).map(norm);
  const col = (...names: string[]) => head.findIndex((c) => names.includes(c));
  const daily = head.includes("in") && head.includes("out");
  const c = {
    date: col("date"), time: col("time"), name: col("name", "person name"), desig: col("designation"), card: col("empno", "employee no"),
    access: col("access"), dir: col("direction"), wo: col("workorderno", "workorder no", "work order no"), inn: col("in"), out: col("out"),
  };
  if (c.card < 0 || c.date < 0 || c.wo < 0) throw new Error("EmpNo / Date / WorkOrderNo columns not found.");

  const rows: PunchRow[] = [];
  let skipped = 0;
  for (let r = h + 1; r < g.length; r++) {
    const x = g[r] ?? [];
    const card = str(x[c.card]);
    const wo = str(x[c.wo]);
    if (!card || !/\d/.test(card) || !wo) { if (x.some((v) => v !== null && v !== "")) skipped++; continue; }
    const base = { card, wo, name: str(x[c.name]), desig: str(x[c.desig]) };
    if (!daily) {
      const ts = stamp(x[c.date], x[c.time]);
      const dir = norm(x[c.dir]) === "entry" ? "Entry" : norm(x[c.dir]) === "exit" ? "Exit" : null;
      if (!ts || !dir) { skipped++; continue; }
      rows.push({ ...base, ts, dir, access: str(x[c.access]) || "Access Granted" });
    } else {
      const tin = x[c.inn] ? stamp(x[c.date], x[c.inn]) : null;
      let tout = x[c.out] ? stamp(x[c.date], x[c.out]) : null;
      if (!tin && !tout) { skipped++; continue; }
      // an OUT earlier than the IN, or an OUT before 10:00 with no IN, is the next morning
      if (tout && ((tin && tout < tin) || (!tin && Number(tout.slice(11, 13)) < 10))) tout = nextDay(tout);
      if (tin) rows.push({ ...base, ts: tin, dir: "Entry", access: "Access Granted" });
      if (tout) rows.push({ ...base, ts: tout, dir: "Exit", access: "Access Granted" });
    }
  }
  const workOrders: PunchParse["workOrders"] = {};
  const cardsPerWo = new Map<string, Set<string>>();
  const months = new Map<string, number>();
  for (const p of rows) {
    const w = (workOrders[p.wo] ??= { cards: 0, punches: 0, denied: 0 });
    w.punches++;
    if (p.access !== "Access Granted") w.denied++;
    if (!cardsPerWo.has(p.wo)) cardsPerWo.set(p.wo, new Set());
    cardsPerWo.get(p.wo)!.add(p.card);
    const m = p.ts.slice(0, 7);
    months.set(m, (months.get(m) ?? 0) + 1);
  }
  for (const [wo, s] of cardsPerWo) workOrders[wo].cards = s.size;
  const month = [...months.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { format: daily ? "daily" : "gate", rows, skipped, workOrders, month };
}
