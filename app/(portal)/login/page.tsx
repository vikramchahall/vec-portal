import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Mark } from "@/components/vec/Icon";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string; out?: string }> }) {
  if (await currentUser()) redirect("/portal");
  const sp = await searchParams;
  const notice = sp.out ? "You have been signed out." : undefined;
  return (
    <div className="login">
      <div className="art" style={{ backgroundImage: "url('/images/control-room.jpg')" }}>
        <div className="row">
          <Mark light size={44} />
          <div><b style={{ font: "700 18px var(--display)" }}>Vikram Engineering Co.</b><div style={{ fontSize: 12, opacity: 0.75 }}>Business Operations Portal</div></div>
        </div>
        <div style={{ marginTop: "auto", maxWidth: 460 }}>
          <div style={{ font: "600 30px/1.2 var(--display)" }}>Every site, every worker, every rupee — in one place.</div>
          <p style={{ opacity: 0.8, marginTop: 12 }}>Punch data to Time Compliance, Working Salary, challans and payslips for HMEL Bathinda, HZL Chanderiya and HZL Debari.</p>
        </div>
      </div>
      <div className="form"><div className="box"><LoginForm notice={notice} /></div></div>
    </div>
  );
}
