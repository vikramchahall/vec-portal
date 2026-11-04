"use server";

import { redirect } from "next/navigation";
import { workerLogin, workerLogout } from "@/lib/worker";

export type WorkerLoginState = { message: string; card: string; dob: string } | null;

export async function workerLoginAction(_prev: WorkerLoginState, form: FormData): Promise<WorkerLoginState> {
  const card = String(form.get("card") ?? ""), dob = String(form.get("dob") ?? "");
  const r = await workerLogin(card, dob);
  // the form is reset after an action: hand the typed values back so a wrong try does not clear them
  if (!r.ok) return { message: r.message, card, dob };
  redirect("/worker");
}

export async function workerLogoutAction() {
  await workerLogout();
  redirect("/worker/login?out=1");
}
