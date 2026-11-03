"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export type LoginState = { message: string } | null;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { message: "Enter your email and password." };
  const r = await login(email, password);
  if (!r.ok) return { message: r.message };
  redirect("/portal");
}
