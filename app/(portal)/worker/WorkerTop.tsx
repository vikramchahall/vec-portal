import Link from "next/link";
import { Icon, Mark } from "@/components/vec/Icon";
import { workerLogoutAction } from "./actions";

export default function WorkerTop({ name }: { name: string }) {
  return (
    <header className="worker-top no-print">
      <Link href="/worker" className="row" style={{ gap: 10, color: "#fff" }}><Mark light size={32} /><div><b>Vikram Engineering Co.</b><span>{name}</span></div></Link>
      <form action={workerLogoutAction} style={{ marginLeft: "auto" }}>
        <button className="btn sm" type="submit"><Icon name="logout" size="sm" />Sign out</button>
      </form>
    </header>
  );
}
