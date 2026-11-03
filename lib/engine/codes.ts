/**
 * Day codes, weekly off and L / CL cover (BRD-01 3.6–3.7), in two steps like the
 * October workbooks:
 *   1. weeklyOffCodes  = the "Punch Attendance" sheet (engine.py `codes_for`)
 *   2. coverAndBalances = the "Attendance Format" and "C-Off" sheets (their formulas)
 * Hand changes from the office replace a raw code between the two steps, exactly as
 * typing into the Punch Attendance sheet did.
 */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Code = "P" | "HP" | "H" | "WO" | "X" | "L" | "CL" | "OD" | "";

export type LeaveSettings = {
  lPerWorkedDay: number;   // L earned per P / HP day (0.064, confirmed 03-Nov-2026)
  excessFactor: number;    // CL hours = excess × 2 + less (confirmed)
  clHoursPerDay: number;   // 8 CL hours = 1 day
  cover: boolean;          // drivers: absences are not covered
};
export const DEFAULT_LEAVE: LeaveSettings = { lPerWorkedDay: 0.064, excessFactor: 2, clHoursPerDay: 8, cover: true };

/**
 * Raw codes for one person and month.
 * worked = days with a duty; joinedDay = first day the person can have a code (new joiner), else 1.
 * Weekly off: the first WO is due on the usual weekday; a no-duty day on or after the due day is WO and the
 * next WO is due 7 days later; a no-duty day before it is X. Holidays are HP / H. Someone whose last duty is
 * more than 7 days before month end gets no WO after it (left). No duty at all = X every day.
 */
export function weeklyOffCodes(o: { year: number; month: number; days: number; holidays: number[]; woWeekday: string | null; joinedDay?: number | null; worked: Set<number>; leftRule?: boolean }): Code[] {
  const wd = WEEKDAYS.indexOf((o.woWeekday ?? "Sun") as (typeof WEEKDAYS)[number]);
  const dow = (d: number) => new Date(Date.UTC(o.year, o.month - 1, d)).getUTCDay();
  const j = o.joinedDay ?? 1;
  let due = 99;
  for (let d = j; d <= o.days; d++) if (dow(d) === (wd < 0 ? 0 : wd)) { due = d; break; }
  const lastWork = o.worked.size ? Math.max(...o.worked) : 0;
  const leftRule = o.leftRule ?? true;
  const codes: Code[] = Array(o.days).fill("");
  for (let i = 1; i <= o.days; i++) {
    if (i < j) continue;
    if (o.holidays.includes(i)) { codes[i - 1] = o.worked.has(i) ? "HP" : "H"; continue; }
    if (o.worked.has(i)) { codes[i - 1] = "P"; continue; }
    if (i >= due && !(leftRule && lastWork <= o.days - 7 && i > lastWork)) { codes[i - 1] = "WO"; due = i + 7; }
    else codes[i - 1] = "X";
  }
  if (!o.worked.size) return codes.map((c) => (c ? "X" : c));
  return codes;
}

export type Balances = {
  final: Code[];
  counts: { P: number; H: number; HP: number; WO: number; L: number; CL: number; X: number; payable: number };
  coff: { excess: number; less: number; clHours: number; totalCl: number };
  avail: { l: number; cl: number };
  bf: { cl: number; l: number }; credit: { cl: number; l: number }; used: { cl: number; l: number }; close: { cl: number; l: number };
};

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const cnt = (a: Code[], c: Code) => a.reduce((n, x) => n + (x === c ? 1 : 0), 0);

/**
 * Attendance Format formulas: X days are taken in date order and covered with whole days of L first,
 * then CL; the rest stay X. L earned = 0.064 per P / HP day; CL credited = (excess × 2 + less) ÷ 8 from
 * the month's C-Off hours on worked days. Closing = B/F + credited − used (kept with decimals).
 */
export function coverAndBalances(raw: Code[], coffByDay: number[], bf: { cl: number; l: number }, s: LeaveSettings = DEFAULT_LEAVE): Balances {
  let excess = 0, less = 0;
  raw.forEach((c, i) => {
    if (c !== "P" && c !== "HP") return;
    const v = coffByDay[i] ?? 0;
    if (v > 0) excess += v; else less += v;
  });
  const clHours = excess * s.excessFactor + less;
  const totalCl = clHours / s.clHoursPerDay;
  const workedRaw = cnt(raw, "P") + cnt(raw, "HP");
  const availL = s.cover ? Math.max(0, Math.floor(round6(bf.l + workedRaw * s.lPerWorkedDay)) - cnt(raw, "L")) : 0;
  const availCl = s.cover ? Math.max(0, Math.floor(round6(bf.cl + totalCl)) - cnt(raw, "CL")) : 0;
  let xSeen = 0;
  const final = raw.map((c): Code => {
    if (c !== "X" || !s.cover) return c;
    xSeen++;
    return xSeen <= availL ? "L" : xSeen <= availL + availCl ? "CL" : "X";
  });
  const counts = { P: cnt(final, "P"), H: cnt(final, "H"), HP: cnt(final, "HP"), WO: cnt(final, "WO") + cnt(final, "OD"), L: cnt(final, "L"), CL: cnt(final, "CL"), X: cnt(final, "X"), payable: 0 };
  counts.payable = counts.P + counts.H + counts.HP + counts.WO + counts.L + counts.CL;
  const credit = { cl: totalCl, l: (counts.P + counts.HP) * s.lPerWorkedDay };
  const used = { cl: counts.CL, l: counts.L };
  return {
    final, counts, coff: { excess, less, clHours, totalCl }, avail: { l: availL, cl: availCl },
    bf, credit, used, close: { cl: round6(bf.cl + credit.cl - used.cl), l: round6(bf.l + credit.l - used.l) },
  };
}
