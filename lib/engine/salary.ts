/**
 * Working Salary (BRD-01 3.8): the formulas of the October-2026 "Working Salary" sheet,
 * column by column, in the same order and with Excel's ROUNDUP, so every rupee matches.
 *
 *   M..Q earned = ROUNDUP(full ÷ days in month × payable days)       R gross = sum
 *   V HP = ROUNDUP(full gross ÷ 26 × HP days)                          W total earning
 *   X PF 12% = ROUNDUP(MIN(R − O, ceiling) × 12%) × PF flag           AA employer 13%
 *   Y ESIC 0.75% = ROUNDUP((W + AD) × 0.75%) × ESI flag                AB employer 3.25%
 *   Z / AC LWF 5 / 20 · AD bonus = ROUNDUP(M × 8.33%) × bonus flag    AE annual bonus otherwise
 *   AG net = W − X − Y − Z + AD − hold + leave encashment · AH PT 200 if full gross × 12 > 2,50,000
 *   AK CTC = W + AA + AB + AC + AD + AE + AF                           AL billing CTC = AK − hold
 */

export type Structure = { basicDa: number; da?: number; hra: number; special: number; conveyance: number };
export type SalaryInput = {
  structure: Structure; payableDays: number; lopDays: number; hpDays: number; otDays?: number;
  pf: boolean; esi: boolean; bonusMonthly: boolean; hold?: number; leaveEncashment?: number;
  annualBonus?: boolean; // false for drivers: no bonus at all (October driver sheets)
};
export type SalarySettings = {
  daysInMonth: number; hpDivisor: number; pfCeiling: number; pfCeilingFull: number; esiLimit: number;
  ptAmount: number; ptAnnualAbove: number; lwfEmployee: number; lwfEmployer: number; bonusRate: number;
};
export const salarySettings = (daysInMonth: number): SalarySettings => ({
  daysInMonth, hpDivisor: 26, pfCeiling: 25000, pfCeilingFull: 25000, esiLimit: 21000,
  ptAmount: 200, ptAnnualAbove: 250000, lwfEmployee: 5, lwfEmployer: 20, bonusRate: 0.0833,
});

/** Excel ROUNDUP(x, 0): away from zero, after Excel's 15-significant-digit rounding. */
export function roundUp(x: number): number {
  const v = Number(x.toPrecision(15));
  return v >= 0 ? Math.ceil(v) : -Math.ceil(-v);
}

export type SalaryLine = {
  // H..L
  basic: number; daMw: number; fullBasicDa: number; payableDays: number; lop: number;
  // M..W
  earnedBasicDa: number; earnedDa: number; earnedHra: number; earnedSpecial: number; earnedConveyance: number; gross: number;
  otDays: number; hpDays: number; otAmount: number; hpAmount: number; totalEarning: number;
  // X..AL
  pf: number; esi: number; lwf: number; pfEmployer: number; esiEmployer: number; lwfEmployer: number;
  bonus: number; annualBonus: number; leaveEncashment: number; net: number; pt: number; netAfterPt: number; hold: number; ctc: number; ctcBilling: number;
  // AN..BB (full month)
  full: { basicDa: number; da: number; hra: number; special: number; conveyance: number; gross: number; pf: number; esi: number; pfEmployer: number; esiEmployer: number; bonus: number; net: number; ctc: number };
};

export function calcSalary(x: SalaryInput, s: SalarySettings): SalaryLine {
  const st = { da: 0, ...x.structure };
  const K = x.payableDays, days = s.daysInMonth;
  // full month (AN..BB)
  const fullGross = st.basicDa + st.da + st.hra + st.special + st.conveyance; // AS
  const fullBonus = roundUp(st.basicDa * s.bonusRate); // AZ
  const fullPf = roundUp(fullGross - st.hra > s.pfCeilingFull ? s.pfCeilingFull * 0.12 : (fullGross - st.hra) * 0.12); // AT
  const fullEsi = roundUp(fullGross >= s.esiLimit ? 0 : (fullGross + fullBonus) * 0.0075); // AU
  const fullPfEr = roundUp(fullGross - st.hra > s.pfCeilingFull ? s.pfCeilingFull * 0.13 : (fullGross - st.hra) * 0.13); // AW
  const fullEsiEr = roundUp(fullGross >= s.esiLimit ? 0 : (fullGross + fullBonus) * 0.0325); // AX
  const fullNet = roundUp(fullGross - s.lwfEmployee - fullPf - fullEsi + fullBonus); // BA
  const fullCtc = roundUp(fullGross + s.lwfEmployer + fullPfEr + fullBonus + fullEsiEr); // BB
  const pfFlag = x.pf ? 1 : 0, esiFlag = x.esi ? 1 : 0, bonusFlag = x.bonusMonthly ? 1 : 0;

  const M = roundUp((st.basicDa / days) * K);
  const N = roundUp((st.da / days) * K);
  const O = roundUp((st.hra / days) * K);
  const P = roundUp((st.special / days) * K);
  const Q = roundUp((st.conveyance / days) * K);
  const R = M + N + O + P + Q;
  const S = x.otDays ?? 0, T = x.hpDays;
  const U = roundUp(((fullGross / s.hpDivisor) * S) * 2);
  const V = roundUp((fullGross / s.hpDivisor) * T);
  const W = R + U + V;
  const AD = roundUp(M * s.bonusRate) * bonusFlag;
  const X = roundUp((R - O > s.pfCeiling ? s.pfCeiling * 0.12 : (R - O) * 0.12) * pfFlag);
  const Y = roundUp((W + AD) * 0.0075 * esiFlag);
  const Z = s.lwfEmployee;
  const AA = roundUp((R - O > s.pfCeiling ? s.pfCeiling * 0.13 : (R - O) * 0.13) * pfFlag);
  const AB = roundUp((W + AD) * 0.0325 * esiFlag);
  const AC = s.lwfEmployer;
  const AE = (bonusFlag || x.annualBonus === false ? 0 : 1) * roundUp(M * s.bonusRate);
  const AF = x.leaveEncashment ?? 0;
  const AJ = x.hold ?? 0;
  const AG = W - X - Y - Z + AD - AJ + AF;
  const AH = K > 0 && fullGross * 12 > s.ptAnnualAbove ? s.ptAmount : 0;
  const AK = W + AA + AB + AC + AD + AE + AF;
  return {
    basic: st.basicDa - st.basicDa * 0.25, daMw: st.basicDa * 0.25, fullBasicDa: st.basicDa, payableDays: K, lop: x.lopDays,
    earnedBasicDa: M, earnedDa: N, earnedHra: O, earnedSpecial: P, earnedConveyance: Q, gross: R,
    otDays: S, hpDays: T, otAmount: U, hpAmount: V, totalEarning: W,
    pf: X, esi: Y, lwf: Z, pfEmployer: AA, esiEmployer: AB, lwfEmployer: AC, bonus: AD, annualBonus: AE, leaveEncashment: AF,
    net: AG, pt: AH, netAfterPt: AG - AH, hold: AJ, ctc: AK, ctcBilling: AK - AJ,
    full: { basicDa: st.basicDa, da: st.da, hra: st.hra, special: st.special, conveyance: st.conveyance, gross: fullGross, pf: fullPf, esi: fullEsi, pfEmployer: fullPfEr, esiEmployer: fullEsiEr, bonus: fullBonus, net: fullNet, ctc: fullCtc },
  };
}

/** Column letter of each Working Salary value (used by the export and the golden test). */
export const WS_COLUMNS: [string, (l: SalaryLine) => number][] = [
  ["K", (l) => l.payableDays], ["L", (l) => l.lop], ["M", (l) => l.earnedBasicDa], ["N", (l) => l.earnedDa], ["O", (l) => l.earnedHra],
  ["P", (l) => l.earnedSpecial], ["Q", (l) => l.earnedConveyance], ["R", (l) => l.gross], ["S", (l) => l.otDays], ["T", (l) => l.hpDays],
  ["U", (l) => l.otAmount], ["V", (l) => l.hpAmount], ["W", (l) => l.totalEarning], ["X", (l) => l.pf], ["Y", (l) => l.esi], ["Z", (l) => l.lwf],
  ["AA", (l) => l.pfEmployer], ["AB", (l) => l.esiEmployer], ["AC", (l) => l.lwfEmployer], ["AD", (l) => l.bonus], ["AE", (l) => l.annualBonus],
  ["AF", (l) => l.leaveEncashment], ["AG", (l) => l.net], ["AH", (l) => l.pt], ["AI", (l) => l.netAfterPt], ["AJ", (l) => l.hold], ["AK", (l) => l.ctc], ["AL", (l) => l.ctcBilling],
];
