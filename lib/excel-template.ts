import JSZip from "jszip";
import type { MonthSalary, PayRow } from "@/lib/payroll";

/**
 * Working Salary export into the unit's own workbook (a past month's file uploaded on Sites & Units).
 *
 * The workbook is edited at the XML level, so everything Excel keeps — styles, conditional colours,
 * validations, images, the Slips sheet, print settings — stays exactly as the team made it. On each
 * person sheet only the person rows are rebuilt: the first person row is the pattern (its formulas are
 * copied down as Excel's fill-down would; its typed cells get this month's values from the portal), and
 * the rows under the list (totals, daily counts, signatures) move with the end of the list, their
 * ranges stretched to match. Titles, the day / weekday header and the sheet name follow the new month.
 */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KEEP = Symbol("keep");
type Val = string | number | null;
type V = Val | typeof KEEP;

type Ctx = { ms: MonthSalary; rows: PayRow[]; y: number; m: number; D: number; unit: string; accounts: Map<number, string> };

// ---------- small XML / A1 helpers ----------
const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colN = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colL = (n: number) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const isCard = (v: unknown) => /^\d{5,}$/.test(String(v ?? "").trim());
const attr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const setAttr = (attrs: string, name: string, value: string) => (new RegExp(`(?:^|\\s)${name}="[^"]*"`).test(attrs) ? attrs.replace(new RegExp(`(^|\\s)${name}="[^"]*"`), `$1${name}="${value}"`) : `${attrs} ${name}="${value}"`);
const dropAttr = (attrs: string, name: string) => attrs.replace(new RegExp(`\\s*(?:^|\\s)${name}="[^"]*"`), "");

/** Move every A1 reference outside "string literals"; fn gets the sheet prefix ("" for this sheet) and the parts. */
function mapRefs(formula: string, fn: (sheet: string, col: number, colAbs: boolean, row: number, rowAbs: boolean) => [number, number]): string {
  const REF = /(?<![A-Za-z0-9_.])('(?:[^']|'')+'!|[A-Za-z_][A-Za-z0-9_.]*!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g;
  return formula.split(/("(?:[^"]|"")*")/).map((part, i) => (i % 2 ? part : part.replace(REF, (m, sh: string | undefined, ca: string, col: string, ra: string, row: string) => {
    const [c, r] = fn((sh ?? "").replace(/^'|'?!$/g, "").replace(/''/g, "'"), colN(col), ca === "$", Number(row), ra === "$");
    return `${sh ?? ""}${ca}${colL(c)}${ra}${r}`;
  }))).join("");
}
const slide = (f: string, dr: number, dc: number) => mapRefs(f, (_, c, ca, r, ra) => [ca ? c : c + dc, ra ? r : r + dr]);

/** Row mapping for ranges after the block first..last becomes first..newLast (rows below move by delta). */
function rowMapper(first: number, last: number, newLast: number) {
  const delta = newLast - last;
  return (r: number, isEnd: boolean) => (r < first ? r : r > last ? r + delta : isEnd && r === last ? newLast : Math.min(r, newLast));
}
/** "A1:B9 C3" style range lists through the row mapper; ranges that fall wholly in removed rows are dropped. */
function mapRangeList(list: string, first: number, last: number, newLast: number) {
  const mr = rowMapper(first, last, newLast);
  return list.split(/\s+/).filter(Boolean).flatMap((rg) => {
    const [a, b = a] = rg.split(":");
    const pa = /^(\$?[A-Z]+)(\$?)(\d+)$/.exec(a), pb = /^(\$?[A-Z]+)(\$?)(\d+)$/.exec(b);
    if (!pa || !pb) return [rg];
    const r1 = Number(pa[3]), r2 = Number(pb[3]);
    if (r1 >= first && r1 <= last && r1 > newLast) return [];
    const s = `${pa[1]}${pa[2]}${mr(r1, false)}`, e = `${pb[1]}${pb[2]}${mr(r2, true)}`;
    return [rg.includes(":") ? `${s}:${e}` : s];
  }).join(" ");
}

// ---------- sheet model ----------
type Cell = { col: number; attrs: string; inner: string };
type Row = { r: number; attrs: string; cells: Cell[] };

function parseRows(sheetData: string): Row[] {
  const rows: Row[] = [];
  for (const m of sheetData.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(attr(m[1], "r"));
    const cells: Cell[] = [];
    for (const c of (m[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], "r")!;
      cells.push({ col: colN(/^[A-Z]+/.exec(ref)![0]), attrs: dropAttr(c[1], "r"), inner: c[2] ?? "" });
    }
    rows.push({ r, attrs: dropAttr(m[1], "r"), cells });
  }
  return rows;
}
const rowXml = (row: Row) => `<row r="${row.r}"${row.attrs}>${[...row.cells].sort((a, b) => a.col - b.col).map((c) => `<c r="${colL(c.col)}${row.r}"${c.attrs}${c.inner ? `>${c.inner}</c>` : "/>"}`).join("")}</row>`;

function formulaParts(c: Cell) {
  const m = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(c.inner);
  return m ? { attrs: m[1], text: unesc(m[2] ?? "") } : null;
}
const valueOf = (c: Cell | undefined, sst: string[]): unknown => {
  if (!c) return null;
  const t = attr(c.attrs, "t"), v = /<v>([\s\S]*?)<\/v>/.exec(c.inner)?.[1];
  if (t === "s") return v === undefined ? null : sst[Number(v)];
  if (t === "inlineStr") return unesc([...c.inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
  if (t === "str" || t === "e") return v === undefined ? null : unesc(v);
  if (t === "b") return v === "1";
  return v === undefined ? null : Number(v);
};
/** A cell with a typed value (style kept). */
function valueCell(col: number, style: string, v: Val): Cell {
  const s = style ? ` s="${style}"` : "";
  if (v === null || v === "") return { col, attrs: s, inner: "" };
  if (typeof v === "number") return { col, attrs: s, inner: `<v>${v}</v>` };
  return { col, attrs: `${s} t="inlineStr"`, inner: `<is><t xml:space="preserve">${esc(v)}</t></is>` };
}

/** Full formula text of every formula cell, shared-formula children resolved from their master. */
function resolveFormulas(rows: Row[]) {
  const masters = new Map<string, { r: number; col: number; text: string }>();
  for (const row of rows) for (const c of row.cells) {
    const f = formulaParts(c);
    if (f && attr(f.attrs, "t") === "shared" && attr(f.attrs, "ref") && f.text) masters.set(attr(f.attrs, "si")!, { r: row.r, col: c.col, text: f.text });
  }
  return (row: Row, c: Cell) => {
    const f = formulaParts(c);
    if (!f) return null;
    if (f.text) return f.text;
    const m = masters.get(attr(f.attrs, "si") ?? "");
    return m ? slide(m.text, row.r - m.r, c.col - m.col) : null;
  };
}
/** A plain (not shared) formula cell. */
const plainFormula = (c: Cell, text: string, extra = ""): Cell => ({ ...c, inner: `<f${extra}>${esc(text)}</f>` });

// ---------- one person sheet ----------
type SheetResult = { xml: string; first: number; last: number; newLast: number } | null;

function fillSheet(xml: string, kind: string, ctx: Ctx, sst: string[], old: { y: number; m: number; D: number } | null, selfName: string): SheetResult {
  const sd = /<sheetData\s*\/>|<sheetData>([\s\S]*)<\/sheetData>/.exec(xml);
  if (!sd || !sd[1]) return null;
  const before = xml.slice(0, sd.index), after = xml.slice(sd.index + sd[0].length);
  const rows = parseRows(sd[1]);
  const at = (r: number) => rows.find((x) => x.r === r);
  const cellAt = (r: number, c: number) => at(r)?.cells.find((x) => x.col === c);
  const persons = rows.filter((row) => isCard(valueOf(row.cells.find((c) => c.col === 1), sst)));
  if (!persons.length) return null;
  const first = persons[0].r, last = persons[persons.length - 1].r;
  const { rows: people, D, y, m } = ctx;
  const n = people.length, newLast = first + n - 1, delta = newLast - last;
  const formulaOf = resolveFormulas(rows);

  // merged ranges (to read header labels, and to rebuild per-row and footer merges)
  const merges = [...after.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/g)].map((x) => ({ c1: colN(x[1]), r1: Number(x[2]), c2: colN(x[3]), r2: Number(x[4]) }));
  const mergeAt = (r: number, c: number) => merges.find((g) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2);

  // ----- header: labels, day row, month words -----
  const maxCol = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.col)));
  const labels: string[][] = [];
  for (let c = 1; c <= maxCol; c++) {
    const l: string[] = [];
    for (let r = Math.max(1, first - 3); r < first; r++) {
      const g = mergeAt(r, c);
      const v = valueOf(g ? cellAt(g.r1, g.c1) : cellAt(r, c), sst);
      if (typeof v === "string" && v.trim()) l.push(norm(v));
    }
    labels[c] = l;
  }
  let dayRow = 0, dayCol = 0;
  // only the attendance sheets have a day header (General Salary has a 1, 2, 3 … column-number row)
  if (["pa", "af", "ot", "coff"].includes(kind)) for (const row of rows.filter((x) => x.r < first)) {
    const nums = new Map(row.cells.map((c) => [c.col, valueOf(c, sst)]));
    for (const [c, v] of nums) if (v === 1 && nums.get(c + 1) === 2 && nums.get(c + 2) === 3) { dayRow = row.r; dayCol = c; break; }
    if (dayRow) break;
  }
  const dayOf = (c: number) => (dayCol && c >= dayCol && c < dayCol + 31 ? c - dayCol + 1 : 0);
  const has = (l: string[], ...w: string[]) => l.some((s) => w.some((x) => s.includes(x)));

  const headRows = rows.filter((x) => x.r < first);
  if (old) {
    const tag = (yy: number, mm: number) => `${MON[mm - 1]}-${String(yy).slice(2)}`;
    const prev = (yy: number, mm: number): [number, number] => (mm === 1 ? [yy - 1, 12] : [yy, mm - 1]);
    const map = new Map<string, string>([
      [tag(old.y, old.m), tag(y, m)], [tag(...prev(old.y, old.m)), tag(...prev(y, m))],
      [MONTH[old.m - 1], MONTH[m - 1]], [MONTH[prev(old.y, old.m)[1] - 1], MONTH[prev(y, m)[1] - 1]],
      [MON[old.m - 1], MON[m - 1]], [MON[prev(old.y, old.m)[1] - 1], MON[prev(y, m)[1] - 1]],
    ]);
    if (old.y !== y) map.set(String(old.y), String(y));
    const words = new RegExp(`\\b(${[...map.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/-/g, "\\-")).join("|")})\\b`, "g");
    const serial = (yy: number, mm: number, dd: number) => Math.round((Date.UTC(yy, mm - 1, dd) - Date.UTC(1899, 11, 30)) / 86400000);
    const s0 = serial(old.y, old.m, 1), s1 = serial(old.y, old.m, old.D);
    for (const row of headRows) {
      const intCount = row.cells.filter((c) => Number.isInteger(valueOf(c, sst)) && !formulaParts(c)).length;
      row.cells = row.cells.map((c) => {
        if (formulaParts(c)) return c;
        const v = valueOf(c, sst), style = attr(c.attrs, "s") ?? "";
        const d = dayOf(c.col);
        if (dayRow && row.r === dayRow && d) return valueCell(c.col, style, d <= D ? d : null);
        if (dayRow && row.r === dayRow + 1 && d && (typeof v === "string" || v === null)) return valueCell(c.col, style, d <= D ? DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : null);
        if (typeof v === "string") {
          if (/\bmw\b/i.test(v)) return c; // the minimum-wage table keeps its months
          const t = v.replace(new RegExp(`(\\b0?1\\s*(?:-|to)\\s*)${old.D}\\b`, "g"), `$1${D}`)
            .replace(new RegExp(`\\b${old.D}(?=\\s+(?:${MONTH[old.m - 1]}|${MON[old.m - 1]})\\b)`, "g"), String(D)) // "… to 31 October 2026"
            .replace(words, (w) => map.get(w) ?? w);
          return t === v ? c : valueCell(c.col, style, t);
        }
        if (typeof v === "number" && v >= s0 && v <= s1) return valueCell(c.col, style, serial(y, m, v - s0 + 1));
        if (typeof v === "number" && v === old.D && old.D !== D && intCount < 10) return valueCell(c.col, style, D);
        return c;
      });
    }
  }

  // ----- the pattern row, constants every row shares, each old person's typed cells -----
  const tplRow = at(first)!;
  const tpl = new Map(tplRow.cells.map((c) => [c.col, c]));
  const oldBy = new Map<string, Map<number, Cell>>();
  // a person whose row had its own formula (edited by hand) keeps it
  const ownFormula = new Map<string, Map<number, { text: string; r: number }>>();
  const relative = (f: string, r: number) => mapRefs(f, (_, c, _ca, rr, ra) => [c, ra ? rr : rr - r + 100000]);
  for (const row of rows.filter((x) => x.r >= first && x.r <= last)) {
    const card = String(valueOf(row.cells.find((c) => c.col === 1), sst) ?? "");
    if (!isCard(card)) continue;
    oldBy.set(card, new Map(row.cells.filter((c) => !formulaParts(c)).map((c) => [c.col, c])));
    const own = new Map<number, { text: string; r: number }>();
    for (const c of row.cells) {
      const f = formulaOf(row, c), t = tplRow.cells.find((x) => x.col === c.col), tf = t ? formulaOf(tplRow, t) : null;
      if (f && tf && relative(f, row.r) !== relative(tf, first)) own.set(c.col, { text: f, r: row.r });
    }
    if (own.size) ownFormula.set(card, own);
  }
  const uniform = new Map<number, Cell>();
  for (const [c, cell] of tpl) {
    if (formulaParts(cell)) continue;
    const vals = new Set([...oldBy.values()].map((x) => JSON.stringify(valueOf(x.get(c), sst))));
    if (vals.size === 1) uniform.set(c, cell);
  }
  const structStart = labels.map((l, i) => (l?.some((s) => s === "basic + da") ? i : -1)).filter((i) => i > 0)[1] ?? -1;
  const bfCols = labels.map((l, i) => (l?.some((s) => s.startsWith("b/f") || s.includes("leave b/f")) ? i : -1)).filter((i) => i > 0);
  const weekdayCount = (wd: string) => Array.from({ length: D }, (_, d) => DOW[new Date(Date.UTC(y, m - 1, d + 1)).getUTCDay()]).filter((x) => x === wd).length;

  const valueFor = (i: number, c: number, isFormula: boolean): V => {
    const row = people[i], l = labels[c] ?? [], d = dayOf(c), b = row.p.b;
    const num = (s: string | null | undefined) => (s && /^\d{1,15}$/.test(s) ? Number(s) : s ?? null);
    if (kind === "master") {
      if (c === 1 || has(l, "employee code")) return num(row.p.card);
      if (has(l, "sl. no", "sr. no")) return i + 1;
      if (has(l, "employee name")) return row.p.name;
      if (has(l, "designation")) return row.p.designation ?? null;
      if (has(l, "esi")) return row.esicIp ? num(row.esicIp) : KEEP;
      if (has(l, "pf account")) return row.pfAccount ?? KEEP;
      if (has(l, "bank name")) return row.bank.name ?? KEEP;
      if (has(l, "bank account", "account no")) { const a = ctx.accounts.get(row.p.employeeId!); return a ? num(a) : KEEP; }
      if (has(l, "ifsc")) return row.bank.ifsc ?? KEEP;
      if (has(l, "uan")) return row.uan ? num(row.uan) : KEEP;
      return KEEP;
    }
    if (c === 1) return num(row.p.card);
    if (c <= 7) {
      if (has(l, "sr. no", "sl. no", "sr.no", "sl.no")) return i + 1;
      if (has(l, "register")) return num(row.regNo);
      if (has(l, "designation")) return row.p.designation ?? null;
      if (has(l, "grade", "category")) return row.category ?? null;
      if (has(l, "joining", "doj", "d.o.j")) return row.doj ? row.doj.split("-").reverse().join(".") : null;
      if (has(l, "name")) return row.p.name;
    }
    if (d) {
      if (d > D) return null;
      if (kind === "pa") return row.p.raw[d - 1] || null;
      if (kind === "af") return isFormula ? KEEP : b?.final[d - 1] || null;
      if (kind === "ot") return isFormula ? KEEP : null; // daily OT hours are not kept in the portal; OT days come from Adjust
      if (kind === "coff") {
        const raw = row.p.raw[d - 1], dut = row.p.duties.find((x) => x.day === d);
        return dut && (raw === "P" || raw === "HP") && dut.coff && row.p.overrides.get(d)?.code !== "NOPUNCH" ? dut.coff : null;
      }
      return KEEP;
    }
    if (kind === "af" && b) {
      if (c === bfCols[0]) return b.bf.cl;
      if (c === bfCols[1]) return b.bf.l;
      if (has(l, "assumed weekly off")) return row.p.woWeekday ?? "Sun";
      if (has(l, "times")) return weekdayCount(row.p.woWeekday ?? "Sun");
    }
    if (kind === "ws" && row.line) {
      if (l.includes("ot") && (row.adj?.otDays ?? 0) > 0) return row.adj!.otDays;
      if (has(l, "leave encashment")) return row.line.leaveEncashment;
      if (has(l, "hold salary")) return row.line.hold;
    }
    if (kind === "gs" && row.structure && !isFormula) {
      const s = row.structure;
      if (has(l, "no.of days", "no. of days")) return D;
      if (has(l, "approved")) return s.basicDa;
      if (structStart > 0 && c > structStart && c <= structStart + 4) return [0, s.hra, s.special, s.conveyance + s.others][c - structStart - 1];
    }
    return KEEP;
  };

  // ----- new person rows -----
  const dataRows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const r = first + i, oldCells = oldBy.get(people[i].p.card);
    const cells: Cell[] = [];
    for (const [c, t] of tpl) {
      const style = attr(t.attrs, "s") ?? "";
      const tf = formulaOf(tplRow, t);
      const v = valueFor(i, c, !!tf);
      if (v !== KEEP) {
        const tt = attr(t.attrs, "t"), textual = tt === "s" || tt === "str" || tt === "inlineStr";
        const w = typeof v === "number" && textual ? String(v) : typeof v === "string" && /^\d{1,15}$/.test(v) && !textual && t.inner ? Number(v) : v;
        cells.push(valueCell(c, style, w === 0 && kind === "gs" && !t.inner ? null : w));
        continue;
      }
      const own = ownFormula.get(people[i].p.card)?.get(c);
      if (tf) cells.push(plainFormula({ col: c, attrs: style ? ` s="${style}"` : "", inner: "" }, own ? slide(own.text, r - own.r, 0) : slide(tf, i, 0), attr(formulaParts(t)!.attrs, "t") === "array" ? ` t="array" ref="${colL(c)}${r}"` : ""));
      else if (uniform.has(c)) cells.push({ ...uniform.get(c)! });
      else if (oldCells?.has(c)) cells.push({ ...oldCells.get(c)!, attrs: style ? setAttr(oldCells.get(c)!.attrs, "s", style) : oldCells.get(c)!.attrs });
      else cells.push(valueCell(c, style, null));
    }
    dataRows.push({ r, attrs: tplRow.attrs, cells });
  }

  // ----- rows under the list move with its end; shared formulas are written out in full -----
  const sameSheet = (sh: string) => !sh || sh === selfName;
  const footRows: Row[] = rows.filter((x) => x.r > last).map((row) => ({
    r: row.r + delta, attrs: row.attrs,
    cells: row.cells.map((c) => {
      const f = formulaParts(c);
      if (!f) return c;
      const full = mapRefs(formulaOf(row, c) ?? "", (sh, col, _ca, r) => [col, sameSheet(sh) && r >= last ? r + delta : r]);
      return plainFormula(c, full, attr(f.attrs, "t") === "array" ? ` t="array" ref="${mapRangeList(attr(f.attrs, "ref") ?? "", first, last, newLast)}"` : "");
    }),
  }));
  for (const row of headRows) row.cells = row.cells.map((c) => {
    const f = formulaParts(c);
    return f && attr(f.attrs, "t") === "shared" ? plainFormula(c, formulaOf(row, c) ?? f.text) : c;
  });
  const newSheetData = `<sheetData>${[...headRows, ...dataRows, ...footRows].map(rowXml).join("")}</sheetData>`;

  // ----- merges, colours, validations, filter, dimension -----
  const rowMerges = merges.filter((g) => g.r1 === first && g.r2 === first);
  const newMerges = [
    ...merges.filter((g) => g.r1 < first),
    ...Array.from({ length: n }, (_, i) => rowMerges.map((g) => ({ ...g, r1: first + i, r2: first + i }))).flat(),
    ...merges.filter((g) => g.r1 > last).map((g) => ({ ...g, r1: g.r1 + delta, r2: g.r2 + delta })),
  ];
  let tail = after.replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, newMerges.length ? `<mergeCells count="${newMerges.length}">${newMerges.map((g) => `<mergeCell ref="${colL(g.c1)}${g.r1}:${colL(g.c2)}${g.r2}"/>`).join("")}</mergeCells>` : "");
  tail = tail.replace(/\bsqref="([^"]*)"/g, (_, s) => `sqref="${mapRangeList(s, first, last, newLast)}"`)
    .replace(/<xm:sqref>([^<]*)<\/xm:sqref>/g, (_, s) => `<xm:sqref>${mapRangeList(s, first, last, newLast)}</xm:sqref>`)
    .replace(/<autoFilter ref="([^"]*)"/, (_, s) => `<autoFilter ref="${mapRangeList(s, first, last, newLast)}"`)
    .replace(/<brk id="(\d+)"/g, (_, r) => `<brk id="${rowMapper(first, last, newLast)(Number(r), true)}"`);
  // blocks whose ranges all fell away would be invalid
  tail = tail.replace(/<conditionalFormatting sqref="">[\s\S]*?<\/conditionalFormatting>/g, "")
    .replace(/<dataValidation\b[^>]*sqref=""[^>]*?(?:\/>|>[\s\S]*?<\/dataValidation>)/g, "");
  tail = tail.replace(/<dataValidations count="\d+"/, `<dataValidations count="${(tail.match(/<dataValidation\b/g) ?? []).length}"`);
  const head = before.replace(/<dimension ref="([^"]*)"/, (_, s) => `<dimension ref="${mapRangeList(s, first, last, newLast)}"`);
  return { xml: head + newSheetData + tail, first, last, newLast };
}

// ---------- the workbook ----------
export async function fillTemplate(file: Buffer, ctx: Ctx): Promise<{ buffer: Buffer; warnings: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const warnings: string[] = [];
  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? "";
  let wbXml = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const target = new Map([...rels.matchAll(/<Relationship\b([^>]*)\/>/g)].map((x) => [attr(x[1], "Id")!, (attr(x[1], "Target") ?? "").replace(/^\/?(xl\/)?/, "xl/")]));
  const sheets = [...wbXml.matchAll(/<sheet\b([^>]*)\/>/g)].map((x, i) => ({ name: unesc(attr(x[1], "name")!), path: target.get(attr(x[1], "r:id")!)!, index: i }));
  const sst = [...(await read("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((x) => unesc([...x[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));

  const wsSheet = sheets.find((s) => /^working\s*salary/i.test(s.name));
  if (!wsSheet) throw new Error("The template has no Working Salary sheet.");
  const mt = /(\w{3})-(\d{2})\s*$/.exec(wsSheet.name);
  const oi = mt ? MON.findIndex((x) => x.toLowerCase() === mt[1].toLowerCase()) : -1;
  const old = oi >= 0 ? { y: 2000 + Number(mt![2]), m: oi + 1, D: new Date(Date.UTC(2000 + Number(mt![2]), oi + 1, 0)).getUTCDate() } : null;
  if (!old) warnings.push(`Could not read the month from the sheet name "${wsSheet.name}" — titles were left as they are.`);
  const newName = `Working Salary ${MON[ctx.m - 1]}-${String(ctx.y).slice(2)}`;

  // people in the order of last month's Working Salary sheet; new joiners after them, in the portal's order
  const wsRows = parseRows(/<sheetData>([\s\S]*)<\/sheetData>/.exec(await read(wsSheet.path))?.[1] ?? "");
  const order = new Map(wsRows.map((r) => String(valueOf(r.cells.find((c) => c.col === 1), sst) ?? "")).filter(isCard).map((card, i) => [card, i]));
  ctx = { ...ctx, rows: [...ctx.rows].sort((a, b) => (order.get(a.p.card) ?? 1e6) - (order.get(b.p.card) ?? 1e6)) };

  const moved = new Map<number, { first: number; last: number; newLast: number }>();
  let tplPeople = 0;
  for (const s of sheets) {
    const name = s.name.trim();
    const kind = /^punch attendance/i.test(name) ? "pa" : /^attendance format/i.test(name) ? "af" : /^ot attendance/i.test(name) ? "ot"
      : /^c-off/i.test(name) ? "coff" : /^working\s*salary/i.test(name) ? "ws" : /^general salary/i.test(name) ? "gs" : /^master( sheet)?$/i.test(name) ? "master" : null;
    if (!kind) continue;
    const res = fillSheet(await read(s.path), kind, ctx, sst, old, s.name);
    if (!res) continue;
    if (kind === "master") tplPeople = res.last - res.first + 1;
    moved.set(s.index, res);
    zip.file(s.path, res.xml);
  }

  // the Working Salary sheet carries the month in its name; formulas, names and doc properties follow
  const quoted = (nm: string) => `'${nm.replace(/'/g, "''")}'!`;
  const renames: [string, string][] = wsSheet.name === newName ? [] : [[quoted(wsSheet.name), quoted(newName)], [quoted(wsSheet.name).replace(/'/g, "&apos;"), quoted(newName).replace(/'/g, "&apos;")]];
  if (renames.length) {
    for (const s of sheets) {
      let x = await read(s.path);
      for (const [a, b] of renames) x = x.split(a).join(b);
      zip.file(s.path, x);
    }
    wbXml = wbXml.replace(`name="${esc(wsSheet.name)}"`, `name="${esc(newName)}"`);
    const app = await read("docProps/app.xml");
    if (app) zip.file("docProps/app.xml", app.split(`>${esc(wsSheet.name)}<`).join(`>${esc(newName)}<`));
  }
  // sheet-local names (filter range, print area) follow the moved rows
  wbXml = wbXml.replace(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g, (_w, a: string, body: string) => {
    let text = unesc(body);
    for (const [x, y2] of renames.slice(0, 1)) text = text.split(x).join(y2);
    const local = attr(a, "localSheetId");
    const mv = local !== undefined ? moved.get(Number(local)) : undefined;
    if (mv) text = mapRefs(text, (_, c, _ca, r) => [c, rowMapper(mv.first, mv.last, mv.newLast)(r, true)]);
    return `<definedName${a}>${esc(text)}</definedName>`;
  });
  // Excel recalculates everything on open; the old calculation chain points at cells that moved
  wbXml = /<calcPr\b/.test(wbXml) ? wbXml.replace(/<calcPr\b([^>]*?)\/>/, (_, a: string) => `<calcPr${setAttr(a, "fullCalcOnLoad", "1")}/>`) : wbXml.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
  zip.file("xl/workbook.xml", wbXml);
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    zip.file("xl/_rels/workbook.xml.rels", rels.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ""));
    zip.file("[Content_Types].xml", (await read("[Content_Types].xml")).replace(/<Override\b[^>]*calcChain[^>]*\/>/, ""));
  }
  const slips = sheets.find((s) => /slip/i.test(s.name));
  if (slips && tplPeople && ctx.rows.length > tplPeople) warnings.push(`The "${slips.name}" sheet has slips for ${tplPeople} people; this month has ${ctx.rows.length}. Print payslips from the portal for everyone.`);
  return { buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), warnings };
}
