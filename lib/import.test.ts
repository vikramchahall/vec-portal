import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook, templateWorkbook, toIsoDate } from "./import";

// A cut-down copy of the October staff Working Salary layout (same headers, made-up people).
function salaryBook() {
  const ws: unknown[][] = [[], [], [],
    ["", "Sl. No", "Register No.", "Name", "Designation", "Category", "Date\nof Joining", "Minimum Wages", "", "", "No.of Days Payable", "LOP", "Basic + DA", "DA", "HRA", "Special Allowance", "Conveyance Allowance", "Gross Salary", "Monthly Bonus", "Basic + DA", "DA", "HRA", "Special Allowance", "Conveyance Allowance", "Gross", "Employee Contribution", "", "", "Monthly Bonus"],
    ["", "", "", "", "", "", "", "Basic", "DA", "Total", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "PF \n12%", "ESIC\n0.75%", "PF \n12%", "", "ESIC\n0.75%"],
    [46869012, 1, 7, "Gurpreet Singh", "Plant Operator", "SKILLED", "12.04.2023", 0, 0, 0, 30, 1, 19979, 0, 2904, 0, 0, 22883, 1665, 20644, 0, 3000, 0, 0, 23644, 2478, 0, 2478, 0, 0],
    [46869044, 2, 20, "Manoj Yadav", "Helper", "UNSKILLED", 46311, 0, 0, 0, 16, 0, 7582, 0, 0, 0, 0, 7582, 632, 14690, 0, 0, 0, 0, 14690, 1763, 120, 1763, 1224, 120],
    ["", "", "", "Total", "", "", "", 0],
  ];
  // the second "Monthly Bonus" (full month) and second PF/ESIC columns sit in the full-month group
  ws[3][28] = "Monthly Bonus";
  const master = [
    ["Employee Code", "Sl. No.", "EMPLOYEE NAME", "DESIGNATION", "LOCATION", "ESI NUMBER", "PF ACCOUNT NUMBER", "BANK NAME", "BANK ACCOUNT NO.", "IFSC CODE", "UAN NO."],
    [46869012, 1, "GURPREET SINGH", "PLANT OPERATOR", "WB-PET,HMEL", "WCP", "", "Punjab National Bank", "12345678904021", "punb0123400", "101234563001"],
  ];
  const af = [[], [], [], ["", "Sr.", "", "Name ", "Designation", "", "", "", "Assumed Weekly Off (most common WO weekday in Sep-26)"], [], [], [46869012, 1, "", "GURPREET SINGH", "", "", "", "", "Sun"]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(af), "Attendance Format");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws), "Working Salary Oct-26");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(master), "Master Sheet");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("toIsoDate", () => {
  it("reads the date formats used in the salary files", () => {
    expect(toIsoDate("12.04.2023")).toBe("2023-04-12");
    expect(toIsoDate("1-8-2026")).toBe("2026-08-01");
    expect(toIsoDate("2026-10-16")).toBe("2026-10-16");
    expect(toIsoDate(46311)).toBe("2026-10-16");
    expect(toIsoDate("")).toBeUndefined();
  });
});

describe("parseWorkbook (salary workbook)", () => {
  const r = parseWorkbook(salaryBook());
  it("finds one row per person and skips the total row", () => {
    expect(r.kind).toBe("salary-workbook");
    expect(r.rows.map((x) => x.cardNo)).toEqual(["46869012", "46869044"]);
  });
  it("takes the full-month structure, not the earned amount", () => {
    expect(r.rows[0]).toMatchObject({ name: "GURPREET SINGH", registerNo: "7", designation: "PLANT OPERATOR", category: "SKILLED", doj: "2023-04-12", basicDa: 20644, hra: 3000 });
    expect(r.rows[1]).toMatchObject({ basicDa: 14690, hra: 0, doj: "2026-10-16" });
  });
  it("derives PF / ESIC / bonus membership from the full-month deductions", () => {
    expect(r.rows[0]).toMatchObject({ pfMember: true, esiMember: false });
    expect(r.rows[1]).toMatchObject({ pfMember: true, esiMember: true, bonusMonthly: true });
  });
  it("adds bank and UAN from the Master Sheet, ignoring non-numeric ESI entries", () => {
    expect(r.rows[0]).toMatchObject({ bankName: "PUNJAB NATIONAL BANK", account: "12345678904021", ifsc: "PUNB0123400", uan: "101234563001", esicIp: undefined });
    expect(r.warnings.join(" ")).toMatch(/1 of 2/);
  });
  it("reads the usual weekly off", () => {
    expect(r.rows[0].woWeekday).toBe("Sun");
  });
});

describe("template", () => {
  it("round-trips the example row", () => {
    const r = parseWorkbook(templateWorkbook());
    expect(r.kind).toBe("template");
    expect(r.rows[0]).toMatchObject({ cardNo: "46860001", unitCode: "STP", basicDa: 17186, pfMember: true, doj: "2026-10-01", ifsc: "SBIN0001234" });
  });
});
