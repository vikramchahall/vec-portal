# Ground truth: the company's Excel formulas

Read directly out of the live workbooks (July-2026). These, not the build
prompt, are the specification for the payroll engine. Where the prompt and
the workbook disagree, the workbook wins and the difference is noted.

Sources:
- `Desktop/dad/Udaipur/July26/WORKING SALARY STRUCTURE VEC FOR HZL DEBARI JULY-2026.xlsm`
  -> sheet `Working Salary July-26`
- `Desktop/dad/RODM/july26/Working_Salary_ETP_REF_July-2026_Vikram.xlsx`
  -> sheet `Working Salary July-2026`

`$BG$1` (HZL) and `$AY$1` (ETP) both hold **days in month** (31).
Both sheets hard-code **26** as the OT divisor.

## HZL Debari (RODM)

| Quantity | Excel | Notes |
|---|---|---|
| Pro-rated component | `ROUNDUP((full/$days)*payable_days, 0)` | each component separately |
| Gross earned | `SUM(N:T)` | basic, da, hra, conv, edu, medical, other |
| OT amount | `ROUNDUP(((Basic+DA)/26)*ot_days*2, 0)` | uses **full** basic+da, not earned |
| HP amount | `ROUNDUP((full_gross/26)*hp_days*2, 0)` | multiplier 2 |
| Night allowance | `night_shifts * 50` | |
| Total earning | `gross_earned + OT + HP + night` | |
| PF employee | `SUM((basic_e + da_e)*12%, 0)` | **no rounding, no ceiling** |
| PF employer | `SUM((basic_e + da_e)*13%, 0)` | |
| ESI | `ROUNDUP((total_earning + bonus)*0.75%, 0) * flag` | flag column carries the 21k test |
| Benevolent fund | `100` | flat |
| LWF | column exists, left blank | |
| Net | `total_earning - pf - esi - benevolent - hold` | no bonus, no WF |
| CTC | `total_earning + pf_er + esi_er + wf_er + bonus` | |

## ETP-HMEL Bathinda (Water Block, sub-contract to Aquatech)

| Quantity | Excel | Notes |
|---|---|---|
| Pro-rated component | `ROUNDUP((full/$days)*payable_days, 0)` | same as HZL |
| OT amount | `ROUNDUP((full_gross/26)*ot_days*2, 0)` | base is **full gross** |
| HP amount | `ROUNDUP((full_gross/26)*hp_days, 0)` | multiplier **1** |
| PF employee | `ROUNDUP(IF((gross_e - hra_e)>15000, 15000*12%, (gross_e - hra_e)*12%), 0)` | ceiling 15,000 |
| PF employer | same shape at 13% | |
| ESI | `ROUNDUP((total_earning + bonus)*0.75%, 0) * flag` | |
| LWF | `5` employee, `20` employer | flat, hard-coded |
| Monthly bonus | `ROUNDUP(basic_e * 0.0833, 0) * flag` | |
| Annual bonus | `IF(flag,0,1) * ROUNDUP(basic_e * 0.0833, 0)` | the other side of the same flag |
| Net | `total_earning - pf - esi - wf + bonus - hold + leave_encashment` | no benevolent/mess/advance |
| CTC | `total_earning + pf_er + esi_er + wf_er + monthly_bonus + annual_bonus + leave_enc` | |
| CTC for billing | `CTC - hold` | |

## Differences from the build prompt

1. **OT is entered in days, not hours.** Column `S`/`X` already holds
   `3`, `3.375`, `0.75` — hours divided by 8 upstream on the OT
   Attendance sheet. We keep per-day hours in `attendance_months.ot_hours`
   and derive days, so both entry styles land in the same place.

2. **HZL's OT base is inconsistent between rows of the same sheet.**
   `ZSD0026611` uses `(Basic+DA)/26`; `ZSD0026616` uses `Gross/26` in the
   same column of the same month. Reproduced via
   `salary_structures.ot_base_override`, which defaults to the site rule.
   Almost certainly a dragged-formula error in the workbook -- confirm
   with the owner before treating it as policy.

3. **PF rounding differs by site.** ETP uses `ROUNDUP`; HZL uses none at
   all, so HZL nets carry paise (`42088.56`). The acceptance figures
   (PF 4,258 / net 42,089) are the *displayed* rounding. We store exact
   and round only at display, which reproduces both.

4. **ETP's `DA` column is vestigial** -- always `0`. Basic and DA are
   carried as one combined figure in the `Basic + DA` column, equal to the
   minimum-wage total. The slip still needs them split, which is what
   `site_rules.da_split_pct = 25` is for (MW 21,100 = 15,825 + 5,275,
   exactly 25%).

5. **The net formula omits different things at each site.** ETP has no
   benevolent fund / mess / advance; HZL has no LWF / bonus. The engine
   computes the superset and the site rules zero out what does not apply,
   rather than two code paths.
