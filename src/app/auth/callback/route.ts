import { type NextRequest, NextResponse } from "next/server";
import {
  type CookieChunk,
  createSupabaseForCallback,
  parseEmailOtpType,
  redirectWithCookies,
} from "@/lib/supabase/auth-callback-shared";

/**
 * Email confirmation from mobile email apps often lands with `token_hash` +
 * `type` (OTP-style) instead of `code` (PKCE). The former works without the
 * PKCE code_verifier that lives in the original signup browser — critical for
 * Gmail in-app Safari / cross-device clicks.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = parseEmailOtpType(typeParam);
  const next = url.searchParams.get("next") ?? "/login";

  const queue: CookieChunk[] = [];

  const fail = () =>
    redirectWithCookies(
      queue,
      `${origin}/login?error=auth_callback_failed`,
    );

  const supabase = createSupabaseForCallback(request, queue);
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // ── OTP / magic-link style (no PKCE verifier) — works from email in-app browsers
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return fail();
    }
    if (type === "recovery") {
      const recoveryNext =
        next && next.startsWith("/") ? next : "/reset-password";
      return redirectWithCookies(queue, `${origin}${recoveryNext}`);
    }
    const isLogin = next === "/login" || next.startsWith("/login");
    if (isLogin) {
      await supabase.auth.signOut();
      return redirectWithCookies(queue, `${origin}/login?verified=1`);
    }
    return redirectWithCookies(
      queue,
      `${origin}${next.startsWith("/") ? next : "/login"}`,
    );
  }

  // ── PKCE authorization code (same browser as signUp has the verifier cookie)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail();
    }
    // Supabase often redirects with only `?code=` and drops `type=recovery` /
    // `next=/reset-password`. If `next` still points at reset-password, honor it.
    if (
      typeParam === "recovery" ||
      next === "/reset-password" ||
      next.startsWith("/reset-password/")
    ) {
      const recoveryNext =
        next && next.startsWith("/") ? next : "/reset-password";
      return redirectWithCookies(queue, `${origin}${recoveryNext}`);
    }
    const isLogin = next === "/login" || next.startsWith("/login");
    if (isLogin) {
      await supabase.auth.signOut();
      return redirectWithCookies(queue, `${origin}/login?verified=1`);
    }
    return redirectWithCookies(
      queue,
      `${origin}${next.startsWith("/") ? next : "/login"}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
