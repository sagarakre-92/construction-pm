import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password recovery: keep the recovery session active so the
      // /reset-password page can call supabase.auth.updateUser().
      if (type === "recovery") {
        const recoveryNext =
          next && next.startsWith("/") ? next : "/reset-password";
        return NextResponse.redirect(`${origin}${recoveryNext}`);
      }
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
