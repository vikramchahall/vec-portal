/**
 * Form XIX wage slips.
 *
 * Two slips per A4 portrait page, matching the layout the company already
 * issues. Generated in the browser with @react-pdf/renderer, so nothing
 * containing wages or bank details leaves the machine.
 */

import type { PayrollLine } from "./payroll";

export type SlipData = {
  empCode: string;
  slNo: number;
  name: string;
  designation: string;
  location: string;
  pfAccount: string;
  esicNumber: string;
  uan: string;
  bankName: string;
  bankAccount: string;
  daysPaid: number;
  lop: number;
  line: PayrollLine;
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen",
  "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty",
  "Seventy", "Eighty", "Ninety"];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t}-${o}` : t;
}

/** Indian numbering: crore, lakh, thousand, hundred. */
export function inWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero";

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore) parts.push(`${under100(crore)} Crore`);
  if (lakh) parts.push(`${under100(lakh)} Lakh`);
  if (thousand) parts.push(`${under100(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(under100(rest));

  return parts.join(" ");
}

export const slipFileName = (s: SlipData, monthLabel: string) =>
  `${s.empCode || s.slNo}_${s.name.replace(/[^A-Za-z0-9]+/g, "_")}_${monthLabel.replace(/\s+/g, "-")}.pdf`;

/**
 * Builds the PDF document. Imported lazily by the caller — @react-pdf is
 * around 1 MB and most portal visits never print a slip.
 */
export async function buildSlipDocument(opts: {
  companyName: string;
  companyAddress: string;
  monthLabel: string;
  slips: SlipData[];
}) {
  const ReactPDF = await import("@react-pdf/renderer");
  const React = await import("react");
  const { Document, Page, Text, View, StyleSheet } = ReactPDF;
  const h = React.createElement;

  const s = StyleSheet.create({
    page: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20,
            fontSize: 7.5, fontFamily: "Helvetica" },
    slip: { borderWidth: 1, borderColor: "#000", padding: 8, marginBottom: 10,
            height: 385 },
    centre: { textAlign: "center" },
    company: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center" },
    address: { fontSize: 7, textAlign: "center", marginTop: 1 },
    form: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center",
            marginTop: 3 },
    month: { fontSize: 8, textAlign: "center", marginTop: 1, marginBottom: 5 },
    rule: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 3 },
    row: { flexDirection: "row" },
    cell: { flex: 1, flexDirection: "row", paddingRight: 4 },
    lbl: { color: "#333" },
    val: { fontFamily: "Helvetica-Bold", flexShrink: 1 },
    colHead: { fontFamily: "Helvetica-Bold", fontSize: 7.5,
               borderBottomWidth: 1, borderBottomColor: "#000",
               paddingBottom: 2, marginBottom: 2 },
    line: { flexDirection: "row", justifyContent: "space-between",
            paddingVertical: 0.8 },
    half: { width: "49%" },
    totalLine: { flexDirection: "row", justifyContent: "space-between",
                 borderTopWidth: 1, borderTopColor: "#000",
                 marginTop: 2, paddingTop: 2, fontFamily: "Helvetica-Bold" },
    net: { marginTop: 5, borderWidth: 1, borderColor: "#000", padding: 4 },
    netRow: { flexDirection: "row", justifyContent: "space-between",
              fontFamily: "Helvetica-Bold", fontSize: 9 },
    words: { fontSize: 7, marginTop: 2, fontStyle: "italic" },
    sign: { flexDirection: "row", justifyContent: "space-between",
            marginTop: 8, fontSize: 6.5, color: "#444" },
  });

  const money = (v: number) =>
    v === 0 ? "0" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const Field = (label: string, value: string) =>
    h(View, { style: s.cell },
      h(Text, { style: s.lbl }, `${label}: `),
      h(Text, { style: s.val }, value || "—"));

  const Item = (label: string, value: number) =>
    h(View, { style: s.line },
      h(Text, null, label),
      h(Text, null, money(value)));

  const Slip = (d: SlipData, key: number) => {
    const L = d.line;

    const earnings: [string, number][] = [
      ["Basic", L.basic],
      ["DA", L.da],
      ["HRA", L.hra],
      ["Conveyance Allowance", L.conveyance],
      ["Education Allowance", L.education],
      ["Medical Allowance", L.medical],
      ["Special Allowance", L.special],
      ["Other Allowance", L.other],
      ["Statutory Bonus", L.monthlyBonus],
      ["Over Time & Holiday Payment", L.otAmount + L.hpAmount],
      ["Night Shift Allowance", L.nightAmount],
    ];

    const deductions: [string, number][] = [
      ["Provident Fund (12%)", L.pfEmployee],
      ["ESI", L.esiEmployee],
      ["Labour Welfare Fund", L.wfEmployee],
      ["Benevolent Fund", L.benevolent],
      ["Hold Salary", L.holdAmount],
    ];

    const totalEarnings =
      L.gross + L.monthlyBonus + L.otAmount + L.hpAmount + L.nightAmount;
    const totalDeductions =
      L.pfEmployee + L.esiEmployee + L.wfEmployee + L.benevolent + L.holdAmount;

    return h(View, { style: s.slip, key },
      h(Text, { style: s.company }, opts.companyName),
      h(Text, { style: s.address }, opts.companyAddress),
      h(Text, { style: s.form }, "Form XIX"),
      h(Text, { style: s.month }, `Salary Slip for the Month of ${opts.monthLabel}`),
      h(View, { style: s.rule }),

      h(View, { style: s.row },
        Field("Emp Name", d.name),
        Field("Designation", d.designation)),
      h(View, { style: s.row },
        Field("Emp No.", `${d.empCode}  -  ${d.slNo}`),
        Field("PF A/c. No.", d.pfAccount)),
      h(View, { style: s.row },
        Field("ESIC No.", d.esicNumber),
        Field("UAN No", d.uan)),
      h(View, { style: s.row },
        Field("Location", d.location),
        Field("Bank", d.bankName)),
      h(View, { style: s.row },
        Field("Account No", d.bankAccount),
        Field("NDP / LOP", `${d.daysPaid} / ${d.lop}`)),
      h(View, { style: s.row },
        Field("MOP", "Credit In Bank Account")),

      h(View, { style: s.rule }),

      h(View, { style: { flexDirection: "row", justifyContent: "space-between" } },
        h(View, { style: s.half },
          h(Text, { style: s.colHead }, "EARNINGS"),
          ...earnings.map(([l, v]) => Item(l, v)),
          h(View, { style: s.totalLine },
            h(Text, null, "Total Earnings"),
            h(Text, null, money(totalEarnings)))),
        h(View, { style: s.half },
          h(Text, { style: s.colHead }, "DEDUCTIONS"),
          ...deductions.map(([l, v]) => Item(l, v)),
          h(View, { style: s.totalLine },
            h(Text, null, "Total Deductions"),
            h(Text, null, money(totalDeductions))))),

      h(View, { style: s.net },
        h(View, { style: s.netRow },
          h(Text, null, "Net Salary"),
          h(Text, null, money(L.netSalary))),
        h(Text, { style: s.words }, `${inWords(L.netSalary)} only`)),

      h(View, { style: s.sign },
        h(Text, null, "(Employee Signature)"),
        h(Text, null,
          "(It is a Computer Generated Report and requires no Signature)")));
  };

  // Two slips per page.
  const pages: SlipData[][] = [];
  for (let i = 0; i < opts.slips.length; i += 2) {
    pages.push(opts.slips.slice(i, i + 2));
  }

  const doc = h(Document, null,
    ...pages.map((pair, i) =>
      h(Page, { size: "A4", style: s.page, key: i },
        ...pair.map((d, j) => Slip(d, j)))));

  return { ReactPDF, doc, Slip, h, Document, Page, styles: s };
}

/** One combined PDF, two slips per page, in Sl No order. */
export async function downloadAllSlips(opts: {
  companyName: string;
  companyAddress: string;
  monthLabel: string;
  slips: SlipData[];
  fileName: string;
}) {
  const { ReactPDF, doc } = await buildSlipDocument(opts);
  const blob = await ReactPDF.pdf(doc as never).toBlob();
  save(blob, opts.fileName);
}

/** A zip of one PDF per employee, named so they can go out individually. */
export async function downloadSlipZip(opts: {
  companyName: string;
  companyAddress: string;
  monthLabel: string;
  slips: SlipData[];
  fileName: string;
  onProgress?: (done: number, total: number) => void;
}) {
  const [{ default: JSZip }, ReactPDF] = await Promise.all([
    import("jszip"),
    import("@react-pdf/renderer"),
  ]);

  const zip = new JSZip();

  for (let i = 0; i < opts.slips.length; i++) {
    const one = opts.slips[i];
    const { doc } = await buildSlipDocument({
      companyName: opts.companyName,
      companyAddress: opts.companyAddress,
      monthLabel: opts.monthLabel,
      slips: [one],
    });
    const blob = await ReactPDF.pdf(doc as never).toBlob();
    zip.file(slipFileName(one, opts.monthLabel), blob);
    opts.onProgress?.(i + 1, opts.slips.length);
  }

  save(await zip.generateAsync({ type: "blob" }), opts.fileName);
}

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
