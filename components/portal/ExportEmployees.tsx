"use client";

import { useState } from "react";
import { downloadEmployees } from "@/lib/excel";
import type { Employee } from "@/lib/types";
import { btnGhost } from "./ui";

/** Exports whatever list is currently on screen, in the master-sheet order. */
export default function ExportEmployees({
  employees,
  siteCode,
}: {
  employees: Employee[];
  siteCode: string;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (employees.length === 0) return;
    setBusy(true);
    try {
      await downloadEmployees(
        employees.map((e) => ({
          "EMPLOYEE CODE": e.emp_code ?? "",
          "EMPLOYEE NAME": e.full_name,
          "FATHER NAME": e.father_name ?? "",
          DESIGNATION: e.designation ?? "",
          CATEGORY: e.category ?? "",
          "DATE OF BIRTH": e.dob ?? "",
          "DATE OF JOINING": e.doj ?? "",
          STATUS: e.status,
          MOBILE: e.mobile ?? "",
          EMAIL: e.email ?? "",
          "AADHAAR (LAST 4)": e.aadhaar_last4 ?? "",
          "UAN / PF ACCOUNT NUMBER": e.uan ?? "",
          "PF ACCOUNT NO.": e.pf_account_no ?? "",
          "ESI NUMBER": e.esi_number ?? "",
          PFAPPLICABLE: e.pf_applicable ? "YES" : "NO",
          ESIAPPLICABLE: e.esi_applicable ? "YES" : "NO",
          "BANK NAME": e.bank_name ?? "",
          "BANK ACCOUNT NO.": e.bank_account_no ?? "",
          "IFSC CODE": e.ifsc ?? "",
          ADDRESS: e.address ?? "",
          NOTES: e.notes ?? "",
        })),
        `Employees ${siteCode} ${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || employees.length === 0}
      className={btnGhost}
    >
      {busy ? "Preparing…" : `Export ${employees.length} to Excel`}
    </button>
  );
}
