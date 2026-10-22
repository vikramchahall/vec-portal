"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadAllSlips, downloadSlipZip, type SlipData } from "@/lib/slip";
import type { PayrollLine } from "@/lib/payroll";
import type { Employee } from "@/lib/types";
import { Notice, btnGhost, btnPrimary } from "./ui";

export type SlipRow = {
  employee: Employee;
  slNo: number;
  line: PayrollLine;
  daysPaid: number;
  lop: number;
};

const rupee = (v: number) =>
  v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Generates Form XIX wage slips from whatever the Working Salary screen
 * currently shows, and locks the month so the figures stop moving.
 */
export default function SalarySlips({
  siteId,
  siteName,
  siteCode,
  companyName,
  companyAddress,
  month,
  monthLabel,
  rows,
}: {
  siteId: string;
  siteName: string;
  siteCode: string;
  companyName: string;
  companyAddress: string;
  month: string;
  monthLabel: string;
  rows: SlipRow[];
}) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [pending, start] = useTransition();

  const slips: SlipData[] = rows.map((r) => ({
    empCode: r.employee.emp_code ?? "",
    slNo: r.slNo,
    name: r.employee.full_name,
    designation: r.employee.designation ?? "",
    location: siteName,
    pfAccount: r.employee.pf_account_no ?? "",
    esicNumber: r.employee.esi_number ?? "",
    uan: r.employee.uan ?? "",
    bankName: r.employee.bank_name ?? "",
    bankAccount: r.employee.bank_account_no ?? "",
    daysPaid: r.daysPaid,
    lop: r.lop,
    line: r.line,
  }));

  const common = { companyName, companyAddress, monthLabel, slips };

  const noBank = rows.filter(
    (r) => !r.employee.bank_account_no || !r.employee.ifsc,
  );
  const totalNet = rows.reduce((t, r) => t + r.line.netSalary, 0);

  async function combined() {
    if (!slips.length) return;
    setBusy("Building the combined PDF…");
    setState(null);
    try {
      await downloadAllSlips({
        ...common,
        fileName: `Salary Slips ${siteCode} ${monthLabel}.pdf`,
      });
      setState({ ok: true, message: `${slips.length} slips downloaded.` });
    } catch (err) {
      setState({
        ok: false,
        message: `Could not build the PDF: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    } finally {
      setBusy("");
    }
  }

  async function individual() {
    if (!slips.length) return;
    setState(null);
    try {
      await downloadSlipZip({
        ...common,
        fileName: `Salary Slips ${siteCode} ${monthLabel}.zip`,
        onProgress: (done, total) => setBusy(`Building slip ${done} of ${total}…`),
      });
      setState({
        ok: true,
        message: `${slips.length} individual PDFs zipped, named for sending.`,
      });
    } catch (err) {
      setState({
        ok: false,
        message: `Could not build the zip: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    } finally {
      setBusy("");
    }
  }

  /**
   * Locking stores the computed line as printed. Next month's comparison
   * reads this, so it reflects what people were actually paid rather than
   * a recomputation under whatever the rates have become since.
   */
  function lock() {
    start(async () => {
      const supabase = createClient();
      const payload = rows.map((r) => ({
        site_id: siteId,
        month,
        employee_id: r.employee.id,
        line: r.line as unknown as Record<string, number>,
      }));

      const { error } = await supabase
        .from("payroll_snapshots")
        .upsert(payload, { onConflict: "employee_id,month" });

      setState(
        error
          ? { ok: false, message: `Could not lock: ${error.message}` }
          : {
              ok: true,
              message: `${monthLabel} locked. Next month will compare against these figures.`,
            },
      );
    });
  }

  return (
    <div>
      <div className="border border-line bg-surface p-6">
        <h3 className="font-display text-lg text-chalk">
          Salary slips — {monthLabel}
        </h3>
        <p className="mt-2 text-[13px] text-mist">
          Form XIX, two per A4 page, built from the figures on the Working
          salary screen. Generated in your browser — nothing is uploaded.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          {[
            ["Slips", String(rows.length)],
            ["Net payable", `₹${rupee(totalNet)}`],
            ["Missing bank details", String(noBank.length)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-5 text-center">
              <p className="font-display text-lg text-chalk">{value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-faint">
                {label}
              </p>
            </div>
          ))}
        </div>

        {noBank.length > 0 ? (
          <p className="mt-5 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[12px] leading-relaxed text-accent-lit">
            {noBank.length} employee{noBank.length === 1 ? "" : "s"} cannot be
            paid by transfer — account number or IFSC is missing:{" "}
            {noBank.slice(0, 5).map((r) => r.employee.full_name).join(", ")}
            {noBank.length > 5 ? "…" : ""}. Their slips still print.
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={combined}
            disabled={!!busy || rows.length === 0}
            className={btnPrimary}
          >
            <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
            <span className="relative z-10">
              {busy || `Download all ${rows.length} slips (one PDF)`}
            </span>
          </button>

          <button
            type="button"
            onClick={individual}
            disabled={!!busy || rows.length === 0}
            className={btnGhost}
          >
            Individual PDFs (.zip)
          </button>

          <button
            type="button"
            onClick={lock}
            disabled={pending || rows.length === 0}
            className={btnGhost}
          >
            {pending ? "Locking…" : `Lock ${monthLabel}`}
          </button>
        </div>

        <div className="mt-5">
          <Notice state={state} />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          Individual files are named{" "}
          <code className="text-mist">CODE_NAME_{monthLabel}.pdf</code> so they
          can be sent one by one. <strong className="text-mist">Lock</strong>{" "}
          freezes this month&apos;s figures for next month&apos;s comparison —
          do it once the slips are right.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead className="bg-raised">
            <tr className="text-left">
              {["#", "Name", "Days", "Gross", "Deductions", "Net"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const L = r.line;
              const ded =
                L.pfEmployee + L.esiEmployee + L.wfEmployee + L.benevolent +
                L.holdAmount;
              return (
                <tr key={r.employee.id} className="border-t border-line hover:bg-deep">
                  <td className="px-3 py-1.5 text-faint">{r.slNo}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-chalk">
                    {r.employee.full_name}
                  </td>
                  <td className="px-3 py-1.5 text-right text-mist">{r.daysPaid}</td>
                  <td className="px-3 py-1.5 text-right text-mist">
                    {rupee(L.totalEarning)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-mist">{rupee(ded)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-chalk">
                    {rupee(L.netSalary)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
