/**
 * Gate punches -> one duty per person per day (BRD-01 3.3–3.5).
 * A line-by-line port of the October-2026 engine (engine.py `daily`), so the
 * portal gives the same IN / OUT / hours / shift / late / C-Off as the issued files.
 *
 * Times are local (IST) wall-clock values without a time zone. Internally they are
 * minutes since 1970-01-01 00:00 treated as UTC, so no time-zone shift can creep in.
 */

export type Punch = { ts: string; dir: "Entry" | "Exit"; access: string };
export type Duty = {
  day: number;              // day of month
  inn: string | null;       // "YYYY-MM-DD HH:MM:SS"
  out: string | null;
  minutes: number | null;   // OUT − IN
  shift: string | null;     // A, G, B, N, C, ?; "12" appended for a 12-hour duty
  late: number;             // minutes after shift start (beyond grace)
  coff: number;             // C-Off hours for the day, half-hour steps (can be negative)
  flags: string[];
};

export type EngineSettings = {
  newDutyGapHours: number;      // Entry this long after the last Exit starts a new duty
  maxDutyHours: number;         // Entry this long after the duty began starts a new duty
  exitGapHours: number;         // Exit this long after the last punch starts a new duty
  mergeBeforeHour: number;      // same-day return before this hour = same duty
  mergeFromHour: number;        // ...if the duty started at or after this hour
  noInMorningHour: number;      // a duty with no IN whose first punch is before this hour belongs to the day before
  graceMinutes: number;
  shifts: { name: string; from: number; to: number; start: number; required: number }[]; // hours, from <= h < to
  twelveHourAt: number; twelveHourCoff: number; thirteenHourAt: number; thirteenHourCoff: number;
  shortStepAt: number; extraAllowance: number; extraStepAt: number; longSpanHours: number;
};

export const DEFAULT_SETTINGS: EngineSettings = {
  newDutyGapHours: 3, maxDutyHours: 16, exitGapHours: 14,
  mergeBeforeHour: 17, mergeFromHour: 4, noInMorningHour: 10, graceMinutes: 15,
  shifts: [
    { name: "A", from: 4.5, to: 6.75, start: 6.0, required: 8.5 },
    { name: "G", from: 6.75, to: 13, start: 8.5, required: 8.5 },
    { name: "B", from: 13, to: 16, start: 14.0, required: 8.0 },
    { name: "N", from: 16, to: 19.5, start: 18.0, required: 9.0 },
    { name: "C", from: 19.5, to: 24, start: 22.0, required: 9.0 },
  ],
  twelveHourAt: 11, twelveHourCoff: 4, thirteenHourAt: 13, thirteenHourCoff: 4.5,
  shortStepAt: 1, extraAllowance: 0.5, extraStepAt: 1, longSpanHours: 16,
};

const toMin = (ts: string) => {
  const [d, t] = ts.split(" ");
  const [y, m, dd] = d.split("-").map(Number);
  const [hh, mm, ss] = (t ?? "00:00:00").split(":").map(Number);
  return Date.UTC(y, m - 1, dd, hh, mm, ss || 0) / 60000;
};
const toTs = (min: number) => new Date(min * 60000).toISOString().replace("T", " ").slice(0, 19);
const dayKey = (min: number) => Math.floor(min / 1440); // days since epoch
const hourOf = (min: number) => Math.floor((min % 1440) / 60);
const floorHalf = (x: number) => Math.floor(x * 2 + 1e-9) / 2;

type Sess = { first: number; last: number; inn: number | null; out: number | null };

export function buildDuties(punches: Punch[], year: number, month: number, s: EngineSettings = DEFAULT_SETTINGS): Duty[] {
  const ps = punches.filter((p) => p.access === "Access Granted").map((p) => ({ t: toMin(p.ts), dir: p.dir })).sort((a, b) => a.t - b.t);

  // 1. sessions
  const sess: Sess[] = [];
  let cur: Sess | null = null;
  let lastExit: number | null = null;
  for (const x of ps) {
    const newSess = cur === null
      || (x.dir === "Entry" && ((lastExit !== null && x.t - lastExit >= s.newDutyGapHours * 60) || x.t - cur.first > s.maxDutyHours * 60))
      || (x.dir === "Exit" && x.t - cur.last > s.exitGapHours * 60);
    if (newSess || cur === null) {
      cur = { first: x.t, last: x.t, inn: null, out: null };
      sess.push(cur);
      lastExit = null;
    }
    cur.last = x.t;
    if (x.dir === "Entry") { if (cur.inn === null) cur.inn = x.t; }
    else { cur.out = x.t; lastExit = x.t; }
  }

  // 2. a day-shift worker stepping out and back in the same day is one duty
  const merged: Sess[] = [];
  for (const c of sess) {
    const p = merged[merged.length - 1];
    const st = c.inn ?? c.first;
    const pst = p ? (p.inn ?? p.first) : null;
    if (p && pst !== null && dayKey(pst) === dayKey(st) && hourOf(st) < s.mergeBeforeHour && hourOf(pst) >= s.mergeFromHour) {
      p.out = c.out ?? p.out;
      p.last = c.last;
      if (p.inn === null) p.inn = c.inn;
      continue;
    }
    merged.push(c);
  }

  // 3. one duty per day: the longest complete one
  const score = (x: Sess): [number, number, number] => [
    x.inn !== null && x.out !== null ? 1 : 0, x.inn !== null && x.out !== null ? x.out - x.inn : 0, x.inn !== null ? 1 : 0];
  const better = (a: Sess, b: Sess) => { const sa = score(a), sb = score(b); for (let i = 0; i < 3; i++) if (sa[i] !== sb[i]) return sa[i] > sb[i]; return false; };
  const byDay = new Map<number, Sess>();
  for (const c of merged) {
    let d = dayKey(c.inn ?? c.first);
    if (c.inn === null && hourOf(c.first) < s.noInMorningHour) d -= 1;
    const prev = byDay.get(d);
    if (!prev || better(c, prev)) byDay.set(d, c);
  }

  // 4. shift, late, C-Off for days in the month
  const out: Duty[] = [];
  for (const [d, c] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const date = new Date(d * 86400000);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month) continue;
    const duty: Duty = { day: date.getUTCDate(), inn: c.inn !== null ? toTs(c.inn) : null, out: c.out !== null ? toTs(c.out) : null, minutes: null, shift: null, late: 0, coff: 0, flags: [] };
    if (c.inn === null) duty.flags.push("IN punch missing");
    if (c.out === null) duty.flags.push("OUT punch missing");
    let required: number | null = null;
    if (c.inn !== null) {
      let h = Math.floor(c.inn % 1440) / 60; // whole minutes, as the October engine (seconds ignored)
      if (h < 4.5) h += 24;
      const sh = s.shifts.find((x) => x.from <= h && h < x.to);
      duty.shift = sh ? sh.name : "?";
      if (sh) {
        required = sh.required;
        if (h > sh.start + s.graceMinutes / 60) duty.late = Math.round((h - sh.start) * 60);
      }
    }
    if (c.inn !== null && c.out !== null) {
      const hrs = (c.out - c.inn) / 60;
      duty.minutes = Math.floor(c.out) - Math.floor(c.inn); // HRS shown as OUT − IN in whole minutes, like the Excel sheet
      if (hrs >= s.twelveHourAt) {
        duty.coff = hrs >= s.thirteenHourAt ? s.thirteenHourCoff : s.twelveHourCoff;
        duty.shift = (duty.shift ?? "?") + "12";
      } else if (required !== null) {
        if (required - hrs >= s.shortStepAt) duty.coff = -floorHalf(required - hrs);
        else if (hrs - (required + s.extraAllowance) >= s.extraStepAt) duty.coff = floorHalf(hrs - (required + s.extraAllowance));
      }
      if (hrs > s.longSpanHours) { duty.flags.push(`span ${hrs.toFixed(1)}h - check punches`); duty.coff = 0; }
      // e.g. a 30-second in/out: usually a card problem, which the office marks (not decided here)
      if (hrs * 60 < 5) duty.flags.push("very short - card issue?");
    }
    out.push(duty);
  }
  return out;
}

/** "05:59", or "06:33 (+1)" when the OUT is on a later day than the duty. */
export function clock(ts: string | null, dutyDay?: string): string {
  if (!ts) return "Missing";
  const hm = ts.slice(11, 16);
  if (dutyDay && ts.slice(0, 10) > dutyDay) {
    const diff = Math.round((Date.parse(ts.slice(0, 10)) - Date.parse(dutyDay)) / 86400000);
    return `${hm} (+${diff})`;
  }
  return hm;
}

export const hhmm = (minutes: number | null) => (minutes === null ? "" : `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`);
