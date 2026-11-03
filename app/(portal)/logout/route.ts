import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(req: Request) {
  await logout();
  // relative to the incoming host so it works behind Nginx
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return NextResponse.redirect(`${proto}://${host}/login?out=1`, 303);
}
