import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import { DEMO_MODE, DEMO_COOKIE } from "@/lib/demo";
import type { Database } from "@/types/database.types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/auth", "/pricing"];

function isPublicPath(path: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) || path === "/"
  );
}

/** Cookie-based gating for DEMO_MODE — no Supabase session involved. */
function demoGate(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get(DEMO_COOKIE)?.value);

  if (!hasSession && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }
  if (hasSession && (path === "/login" || path === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request });
}

/**
 * Refreshes the Supabase session cookie on every request and gates the
 * authenticated app. Returns a NextResponse the root middleware forwards.
 */
export async function updateSession(request: NextRequest) {
  if (DEMO_MODE) return demoGate(request);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) || path === "/";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Signed-in users shouldn't see auth pages.
  if (user && (path === "/login" || path === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
