import { type NextRequest, NextResponse } from "next/server";
import {
  type CookieChunk,
  createSupabaseForCallback,
  parseEmailOtpType,
  redirectWithCookies,
} from "@/lib/supabase/auth-callback-shared";

/**
 * Password reset links use this URL as `redirectTo` so we do not rely on
 * Supabase preserving `type=recovery` and `next=/reset-password` on the
 * redirect (many flows only append `?code=`, which used to fall through to the
 * email-verification branch and sign users out to `/login?verified=1`).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = parseEmailOtpType(typeParam);

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

  if (tokenHash && type) {
    if (type !== "recovery") {
      return fail();
    }
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      return fail();
    }
    return redirectWithCookies(queue, `${origin}/reset-password`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail();
    }
    return redirectWithCookies(queue, `${origin}/reset-password`);
  }

  return fail();
}
