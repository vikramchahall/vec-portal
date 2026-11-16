import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DOC_KINDS, documentMatrix } from "@/lib/documents";
import { unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead, StatusBadge } from "@/components/vec/ui";

export const dynamic = "force-dynamic";

/** Who has which papers on file; upload them on each person's Documents tab. */
export default async function Documents({ searchParams }: { searchParams: Promise<{ unit?: string; missing?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [rows, units] = await Promise.all([documentMatrix({ unit: sp.unit, missing: sp.missing, q: sp.q?.trim() }), unitList()]);
  const shown = DOC_KINDS.filter(([k]) => k !== "other");
  return (
    <>
      <Crumbs items={[["People"], ["Employee Documents"]]} />
      <PageHead title="Employee documents" sub="Aadhaar, PAN, bank passbook, photo and letters for each person — stored encrypted; every view is logged. Upload on the person's Documents tab." />
      <form className="card toolbar" style={{ marginBottom: 16 }}>
        <label className="search-in"><Icon name="search" size="sm" /><input name="q" defaultValue={sp.q} placeholder="Name, card or VEC ID" /></label>
        <select className="select" name="unit" defaultValue={sp.unit ?? ""}><option value="">All units</option>{units.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}</select>
        <select className="select" name="missing" defaultValue={sp.missing ?? ""}><option value="">Any</option>{shown.map(([k, l]) => <option key={k} value={k}>Missing: {l}</option>)}</select>
        <button className="btn" type="submit"><Icon name="filter" size="sm" />Apply</button>
        <span className="ml-auto dim" style={{ fontSize: 12 }}>{rows.length}{rows.length === 500 ? "+" : ""} people</span>
      </form>
      <div className="card"><div className="tbl-wrap" style={{ maxHeight: 680 }}><table className="tbl compact">
        <thead><tr><th>Employee</th><th>Unit</th><th>Status</th>{shown.map(([k, l]) => <th key={k} style={{ textAlign: "center" }}>{l.split(" ")[0]}</th>)}<th className="num">Files</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/portal/employees/${r.id}?tab=documents`}>{r.name}</Link><div className="dim mono" style={{ fontSize: 11 }}>{r.card_no ?? r.vec_id}</div></td>
            <td>{r.unit ?? "—"}</td><td><StatusBadge status={r.status} /></td>
            {shown.map(([k]) => <td key={k} style={{ textAlign: "center" }}>{r.kinds.includes(k) ? <Icon name="checkCircle" size="sm" /> : <span className="dim">·</span>}</td>)}
            <td className="num">{r.files || ""}</td>
          </tr>))}</tbody>
      </table></div></div>
    </>
  );
}
