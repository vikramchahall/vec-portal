/**
 * Spreadsheet reading, shared by every importer.
 *
 * Reads .xlsx / .xlsm / .xls / .csv entirely in the browser — nothing is
 * uploaded anywhere. That is deliberate: these files carry wages, bank
 * accounts and UANs, and sending them to a third-party API to be parsed
 * would be a worse trade than any convenience it bought.
 */

export type Sheet = {
  name: string;
  /** Raw grid, blank rows removed. */
  grid: string[][];
  /** Index into `grid` of the row that looks most like a header. */
  headerRow: number;
  /** Header labels, blanks filled in and duplicates suffixed. */
  headers: string[];
  /** Data rows below the header, as objects keyed by header label. */
  rows: Record<string, string>[];
};

export type Workbook = { sheetNames: string[]; read: (name: string) => Sheet };

export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * SheetJS needs to be told what it is being handed. Passing a bare
 * ArrayBuffer from `file.arrayBuffer()` without `type` works in Node
 * (which sees a Buffer) but throws in the browser — which is exactly the
 * "Could not read that file" you hit. A Uint8Array plus `type: "array"`
 * is the documented browser path and behaves identically in both.
 */
export async function readWorkbook(
  file: File,
  hints: string[][] = [],
): Promise<Workbook> {
  const XLSX = await import("xlsx");
  const data = new Uint8Array(await file.arrayBuffer());

  const wb = XLSX.read(data, {
    type: "array",
    cellDates: false,
    cellNF: false,
    cellText: true,
  });

  if (!wb.SheetNames.length) {
    throw new Error("That workbook has no sheets.");
  }

  const read = (name: string): Sheet => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`Sheet "${name}" is not in this workbook.`);

    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });

    const grid = raw.map((r) => (r ?? []).map((c) => String(c ?? "").trim()));

    // Score each early row for how header-like it is: mostly-filled, and
    // containing words we recognise.
    let headerRow = 0;
    let best = -1;
    for (let i = 0; i < Math.min(grid.length, 25); i++) {
      const cells = grid[i].map(norm);
      const filled = cells.filter(Boolean).length;
      if (filled < 2) continue;

      let score = filled;
      for (const group of hints) {
        if (cells.some((c) => group.some((h) => c === h || c.includes(h)))) {
          score += 12;
        }
      }
      if (score > best) {
        best = score;
        headerRow = i;
      }
    }

    // Blank headers become "Column N"; repeats get a suffix. A Working
    // Salary sheet repeats every money column twice — once for the month,
    // once for the General block — so they must stay distinguishable.
    const seen = new Map<string, number>();
    const headers = (grid[headerRow] ?? []).map((c, i) => {
      const base = c || `Column ${i + 1}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n === 1 ? base : `${base} (${n})`;
    });

    // A Working Salary sheet can declare 270 columns of which 60 carry
    // anything. Showing the empty ones buries the real data, so they are
    // dropped from both the preview and the mapping.
    const used: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      const headerHasText = (grid[headerRow]?.[c] ?? "") !== "";
      const bodyHasText = grid
        .slice(headerRow + 1)
        .some((r) => (r[c] ?? "") !== "");
      if (headerHasText || bodyHasText) used.push(c);
    }

    const keptHeaders = used.map((c) => headers[c]);
    const keptGrid = grid.map((r) => used.map((c) => r[c] ?? ""));

    const rows = grid
      .slice(headerRow + 1)
      .map((r) => {
        const o: Record<string, string> = {};
        headers.forEach((h, i) => {
          o[h] = r[i] ?? "";
        });
        return o;
      })
      .filter((r) => Object.values(r).some(Boolean));

    return {
      name,
      grid: keptGrid,
      headerRow,
      headers: keptHeaders,
      rows: rows.map((r) => {
        const o: Record<string, string> = {};
        for (const h of keptHeaders) o[h] = r[h] ?? "";
        return o;
      }),
    };
  };

  return { sheetNames: wb.SheetNames, read };
}

/** Picks the first sheet whose name matches, else the first sheet. */
export function pickSheet(names: string[], patterns: RegExp[]): string {
  for (const p of patterns) {
    const hit = names.find((n) => p.test(n));
    if (hit) return hit;
  }
  return names[0];
}

/**
 * Auto-maps our fields onto the sheet's headers. Exact matches first, then
 * substring — otherwise "name" claims "bank name" before "employee name"
 * gets a look in.
 */
export function autoMap(
  headers: string[],
  targets: { key: string; hints: readonly string[] }[],
  preferLast: string[] = [],
): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();

  for (const t of targets) {
    const exact = headers.filter(
      (h) => !used.has(h) && t.hints.some((hint) => norm(h) === hint),
    );
    const loose = headers.filter(
      (h) => !used.has(h) && t.hints.some((hint) => norm(h).includes(hint)),
    );
    const pool = exact.length ? exact : loose;
    if (!pool.length) continue;

    const pick = preferLast.includes(t.key) ? pool[pool.length - 1] : pool[0];
    map[t.key] = pick;
    used.add(pick);
  }
  return map;
}

export const toNumber = (v: string | undefined): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const x = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : undefined;
};
