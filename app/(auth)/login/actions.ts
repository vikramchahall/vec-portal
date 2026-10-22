"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | null;

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 160);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const next = String(formData.get("next") ?? "/portal");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: "Sign-in is not configured yet. Add the Supabase keys to .env.local." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: saying "no such user" tells an attacker which
    // addresses exist.
    return { error: "Those details did not match. Please try again." };
  }

  revalidatePath("/", "layout");
  // Only allow in-app paths, so ?next= cannot bounce someone off-site.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/portal");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
