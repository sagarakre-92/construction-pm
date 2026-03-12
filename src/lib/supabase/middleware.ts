import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieEntry = { name: string; value: string; options: Record<string, unknown> };

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Redirect old dashboard/tasks routes to ORAT
  if (pathname === "/dashboard" || pathname === "/tasks" || pathname.startsWith("/dashboard/") || pathname.startsWith("/tasks/")) {
    return NextResponse.redirect(new URL("/orat", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require auth for ORAT and onboarding: redirect unauthenticated users to login
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/auth/callback";
  const isProtectedRoute = pathname.startsWith("/orat") || pathname.startsWith("/onboarding");
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}
