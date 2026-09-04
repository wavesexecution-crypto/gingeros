export function cn(...xs: (string | false | undefined)[]) { return xs.filter(Boolean).join(" "); }
export function fmtMoney(n: number, cur = "USD") {
  if (!n) return `0 ${cur}`;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur}`;
}
export function esc(s: string) { return s; }
