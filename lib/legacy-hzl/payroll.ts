/**
 * Payroll engine.
 *
 * Every rule here was reverse-engineered from the real
 * "Working Salary July-26" sheet for HZL Debari and checked against five
 * live employees — gross, overtime, net and CTC all reproduce to the
 * paisa. See lib/payroll.test-cases.ts for those fixtures.
 *
 * Money rules worth knowing:
 *   - Each earning component is pro-rated and ROUNDED UP separately,
 *     then summed. Summing first and rounding once gives a different
 *     figure.
 *   - Overtime is paid on the FULL monthly rate, never the pro-rated
 *     one — someone who was absent still earns overtime at their normal
 *     hourly rate.
 *   - PF is 12% of EARNED basic + DA, carried to two decimals, not
 *     rounded up. The sheet shows 4258.44, not 4259.
 */

/** Excel's ROUNDUP(x, 0). The tiny epsilon absorbs float noise. */
export const roundUp = (n: number): number => Math.ceil(Number(n.toFixed(6)));

/** Money to two decimals. */
export const money = (n: number): number => Math.round(n * 100) / 100;

export type PayrollRules = {
  otDivisor: number;
  otMultiplier: number;
  /** HZL pays holiday work at 2x; HMEL ETP pays it at 1x. */
  phOtMultiplier: number;
  /**
   * What 12% is charged on.
   *   'basic_da'        -> earned basic + DA          (HZL Debari)
   *   'gross_minus_hra' -> earned gross less HRA      (HMEL ETP)
   * Verified 40/40 against the ETP August-2026 sheet.
   */
  pfBase: "basic_da" | "gross_minus_hra";
  /** ETP charges ESI on total earning PLUS the monthly bonus. */
  esiIncludesBonus: boolean;
  pfEmployeePct: number;
  pfEmployerPct: number;
  esiEmployeePct: number;
  esiEmployerPct: number;
  esiGrossLimit: number;
  pfWageCeiling: number | null;
  wfEmployee: number;
  wfEmployer: number;
  bonusMonthly: boolean;
};

export const DEFAULT_RULES: PayrollRules = {
  otDivisor: 26,
  otMultiplier: 2,
  phOtMultiplier: 2,
  pfBase: "basic_da",
  esiIncludesBonus: false,
  pfEmployeePct: 12,
  pfEmployerPct: 13,
  esiEmployeePct: 0.75,
  esiEmployerPct: 3.25,
  esiGrossLimit: 21000,
  pfWageCeiling: null,
  wfEmployee: 0,
  wfEmployer: 0,
  bonusMonthly: false,
};

export type Structure = {
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  education: number;
  medical: number;
  other: number;
  /** ETP's "Special Allowance" column. Zero at HZL. */
  special: number;
  nightRate: number;
  benevolent: number;
  /** 'mw' pays overtime on basic+DA; 'gross' pays it on the full gross. */
  otBase: "mw" | "gross";
};

export type Attendance = {
  daysInMonth: number;
  daysWorked: number;
  lop: number;
  otDays: number;
  phOtDays: number;
  nightPresents: number;
  holdAmount: number;
};

export type PayrollLine = {
  mwBasic: number;
  mwDa: number;
  mwTotal: number;

  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  education: number;
  medical: number;
  other: number;
  special: number;
  gross: number;

  otAmount: number;
  hpAmount: number;
  nightAmount: number;
  totalEarning: number;

  pfEmployee: number;
  esiEmployee: number;
  benevolent: number;
  wfEmployee: number;

  pfEmployer: number;
  esiEmployer: number;
  wfEmployer: number;

  monthlyBonus: number;
  netSalary: number;
  holdAmount: number;
  ctc: number;
  ctcForBilling: number;
};

export function computeLine(
  s: Structure,
  a: Attendance,
  rules: PayrollRules = DEFAULT_RULES,
): PayrollLine {
  const dim = a.daysInMonth > 0 ? a.daysInMonth : 30;
  const factor = Math.min(a.daysWorked, dim) / dim;

  // Each component pro-rated and rounded up on its own.
  const basic = roundUp(s.basic * factor);
  const da = roundUp(s.da * factor);
  const hra = roundUp(s.hra * factor);
  const conveyance = roundUp(s.conveyance * factor);
  const education = roundUp(s.education * factor);
  const medical = roundUp(s.medical * factor);
  const other = roundUp(s.other * factor);
  const special = roundUp(s.special * factor);

  const gross =
    basic + da + hra + conveyance + education + medical + other + special;

  // Full monthly gross, used for the ESI eligibility test and as the
  // overtime base for staff on a negotiated CTC.
  const fullGross =
    s.basic + s.da + s.hra + s.conveyance + s.education + s.medical +
    s.other + s.special;

  const otBase = s.otBase === "gross" ? fullGross : s.basic + s.da;

  const otAmount = roundUp(
    (otBase / rules.otDivisor) * a.otDays * rules.otMultiplier,
  );
  const hpAmount = roundUp(
    (otBase / rules.otDivisor) * a.phOtDays * rules.phOtMultiplier,
  );
  const nightAmount = a.nightPresents * s.nightRate;

  const totalEarning = gross + otAmount + hpAmount + nightAmount;

  // PF base differs by site; both are capped at the EPFO ceiling when set.
  let pfBase =
    rules.pfBase === "gross_minus_hra" ? gross - hra : basic + da;
  if (rules.pfWageCeiling != null) pfBase = Math.min(pfBase, rules.pfWageCeiling);

  // HZL carries PF to two decimals (4258.44); ETP rounds up (1581).
  const roundPf = rules.pfWageCeiling != null ? roundUp : money;
  const pfEmployee = roundPf((pfBase * rules.pfEmployeePct) / 100);
  const pfEmployer = roundPf((pfBase * rules.pfEmployerPct) / 100);

  // ESI eligibility is judged on the full monthly gross, not the earned
  // one — a month of absence must not drag someone into ESI.
  const esiApplies = fullGross < rules.esiGrossLimit;

  // Bonus is needed before ESI at ETP, so it is computed first.
  const monthlyBonus = rules.bonusMonthly ? roundUp((basic + da) * 0.0833) : 0;
  const esiBase = totalEarning + (rules.esiIncludesBonus ? monthlyBonus : 0);

  const roundEsi = rules.esiIncludesBonus ? roundUp : money;
  const esiEmployee = esiApplies
    ? roundEsi((esiBase * rules.esiEmployeePct) / 100)
    : 0;
  const esiEmployer = esiApplies
    ? roundEsi((esiBase * rules.esiEmployerPct) / 100)
    : 0;

  const deductions =
    pfEmployee + esiEmployee + s.benevolent + rules.wfEmployee + a.holdAmount;

  const netSalary = money(totalEarning + monthlyBonus - deductions);
  const ctc = money(
    totalEarning + monthlyBonus + pfEmployer + esiEmployer + rules.wfEmployer,
  );

  return {
    mwBasic: s.basic,
    mwDa: s.da,
    mwTotal: s.basic + s.da,
    basic,
    da,
    hra,
    conveyance,
    education,
    medical,
    other,
    special,
    gross,
    otAmount,
    hpAmount,
    nightAmount,
    totalEarning,
    pfEmployee,
    esiEmployee,
    benevolent: s.benevolent,
    wfEmployee: rules.wfEmployee,
    pfEmployer,
    esiEmployer,
    wfEmployer: rules.wfEmployer,
    monthlyBonus,
    netSalary,
    holdAmount: a.holdAmount,
    ctc,
    ctcForBilling: money(ctc - a.holdAmount),
  };
}

/**
 * The "General Salary" block on the right of the sheet: what the person
 * would earn at full attendance with no overtime. Clients compare the
 * two, so it is produced from the same structure with a clean month.
 */
export function computeGeneral(
  s: Structure,
  rules: PayrollRules = DEFAULT_RULES,
): PayrollLine {
  return computeLine(
    s,
    {
      daysInMonth: 30,
      daysWorked: 30,
      lop: 0,
      otDays: 0,
      phOtDays: 0,
      nightPresents: 0,
      holdAmount: 0,
    },
    rules,
  );
}

export const daysInMonth = (iso: string): number => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
