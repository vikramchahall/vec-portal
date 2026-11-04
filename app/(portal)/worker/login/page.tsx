import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentWorker } from "@/lib/worker";
import { Mark } from "@/components/vec/Icon";
import WorkerLoginForm from "./WorkerLoginForm";

export const metadata: Metadata = { title: "Worker sign in" };
export const dynamic = "force-dynamic";

export default async function WorkerLoginPage({ searchParams }: { searchParams: Promise<{ out?: string }> }) {
  if (await currentWorker()) redirect("/worker");
  const sp = await searchParams;
  return (
    <div className="worker">
      <header className="worker-top"><Mark light size={32} /><div><b>Vikram Engineering Co.</b><span>Worker salary page</span></div></header>
      <main className="worker-main"><div className="card"><div className="card-b"><WorkerLoginForm notice={sp.out ? "You have been signed out." : undefined} /></div></div></main>
    </div>
  );
}
