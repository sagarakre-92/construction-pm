import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isLogin = next === "/login" || next.startsWith("/login");
      if (isLogin) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?verified=1`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing code or exchange failed: redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
