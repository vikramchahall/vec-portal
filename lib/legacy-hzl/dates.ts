/**
 * Date parsing shared by the forms and the Excel import.
 *
 * Lives outside the "use server" module because every export from one of
 * those must be an async function — a plain helper there fails the build.
 */

/** Accepts dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd and Excel serials. */
export function parseDate(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Indian sheets are day-first throughout, so dd/mm/yyyy is assumed.
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const day = Number(d);
    const month = Number(mo);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Excel serial date: days since 1899-12-30.
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 60000) {
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  }

  return null;
}
