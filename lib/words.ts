/** Rupees in words, Indian numbering (Lakh, Crore) — "Twenty Two Thousand Six Hundred Sixty Nine". */
export function rupeesInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
  const three = (x: number) => (x >= 100 ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " : "") : "") + two(x % 100);
  const parts: [number, string][] = [[Math.floor(n / 10000000), "Crore"], [Math.floor(n / 100000) % 100, "Lakh"], [Math.floor(n / 1000) % 100, "Thousand"]];
  const s = (parts.filter(([v]) => v).map(([v, w]) => `${two(v)} ${w}`).join(" ") + " " + three(n % 1000)).trim();
  return s || "Zero";
}
