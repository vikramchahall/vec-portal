import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { punchFileList, punchMonths } from "@/lib/attendance";
import { unitList } from "@/lib/employees";
import { Icon } from "@/components/vec/Icon";
import { Crumbs, PageHead } from "@/components/vec/ui";
import UploadClient from "./UploadClient";
import DeleteFile from "./DeleteFile";

export default async function PunchUpload() {
  const user = await requireUser();
  const [units, files, months] = await Promise.all([unitList(), punchFileList(), punchMonths()]);
  const woUnit = new Map(units.flatMap((u) => u.workOrders.map((w) => [w, u.code] as const)));
  return (
    <>
      <Crumbs items={[["Attendance"], ["Punch Data Upload"]]} />
      <PageHead title="Punch data upload" sub="Upload the raw gate files exactly as received. The Time Compliance is built from them straight away; codes, leave and salary follow in the next steps." />
      <div className="grid g3">
        <div className="span2"><UploadClient units={units.map((u) => ({ code: u.code, workOrders: u.workOrders }))} /></div>
        <div>
          <div className="card">
            <div className="card-h"><h3>Punches stored</h3></div>
            {months.length === 0 ? <div className="card-b dim">None yet.</div> : (
              <table className="tbl compact"><thead><tr><th>Month</th><th>Work order</th><th className="num">Cards</th><th></th></tr></thead>
                <tbody>{months.map((m) => {
                  const u = woUnit.get(m.work_order);
                  return (<tr key={m.month + m.work_order}><td>{m.month}</td><td className="mono">{m.work_order}</td><td className="num">{m.cards}</td>
                    <td>{u ? <Link href={`/portal/attendance/time-compliance?unit=${u}&month=${m.month}`}>{u} <Icon name="chevR" size="sm" /></Link> : <span className="dim">—</span>}</td></tr>);
                })}</tbody></table>)}
          </div>
          <div className="card mt16">
            <div className="card-h"><h3>Uploaded files</h3></div>
            {files.length === 0 ? <div className="card-b dim">None yet.</div> : (
              <ul className="list">{files.map((f) => (
                <li key={f.id}><div className="ic"><Icon name="fileText" size="sm" /></div>
                  <div style={{ flex: 1 }}><div className="t">{f.fileName}</div>
                    <div className="s">{f.month ?? "?"} · {f.rows.toLocaleString("en-IN")} punches · {f.uploadedBy} · {f.uploadedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}{f.status !== "complete" ? " · incomplete" : ""}</div></div>
                  {user.role === "owner" ? <DeleteFile id={f.id} name={f.fileName} /> : null}</li>))}</ul>)}
          </div>
        </div>
      </div>
    </>
  );
}
