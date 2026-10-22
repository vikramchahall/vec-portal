import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and guards /portal.
 *
 * Auth tokens expire; without this refresh a signed-in user is silently
 * logged out mid-session. It also keeps the portal gate on the server —
 * a client-side redirect can be skipped by disabling JS.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet: let the marketing site work untouched, but never
  // let /portal fall open just because the env is missing.
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/portal")) {
      return NextResponse.redirect(new URL("/login?e=unconfigured", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() revalidates the token with Supabase. getSession() only reads
  // the cookie and can be spoofed, so it must not be used for a gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith("/portal")) {
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
