import Link from "next/link";
import { Icon } from "./Icon";

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <div className="crumbs">
      <Link href="/portal">Home</Link>
      {items.map(([label, href]) => (
        <span key={label} style={{ display: "contents" }}>
          <Icon name="chevR" />
          {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub ? <div className="sub">{sub}</div> : null}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  active: ["b-green", "Active"], left: ["b-grey", "Left"], on_hold: ["b-amber", "On hold"],
};
export function StatusBadge({ status }: { status: string }) {
  const [cls, label] = STATUS[status] ?? ["b-grey", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Alert({ kind, children }: { kind: "info" | "ok" | "warn" | "err"; children: React.ReactNode }) {
  const icon = { info: "info", ok: "checkCircle", warn: "alert", err: "xCircle" }[kind];
  return <div className={`alert ${kind}`}><Icon name={icon} size="sm" /><div>{children}</div></div>;
}

export const inr = (n: number | null | undefined) => (n === null || n === undefined ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));
export const fmtDate = (d: string | null | undefined) => (d ? d.split("-").reverse().join("-") : "—");
export const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
