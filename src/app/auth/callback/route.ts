import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

type CookieChunk = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !EMAIL_OTP_TYPES.has(raw)) return null;
  return raw as EmailOtpType;
}

function appendCookies(
  response: NextResponse,
  queue: CookieChunk[],
): NextResponse {
  queue.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<
      NextResponse["cookies"]["set"]
    >[2]);
  });
  return response;
}

/**
 * Supabase auth callback must attach session cookies to the *redirect response*.
 * `createClient` from `@/lib/supabase/server` wraps `cookies().set()` in try/catch
 * and ignores failures (meant for Server Components), so PKCE exchange can
 * "succeed" while no Set-Cookie headers are sent — users land on login broken.
 *
 * Email confirmation from mobile email apps often lands with `token_hash` +
 * `type` (OTP-style) instead of `code` (PKCE). The former works without the
 * PKCE code_verifier that lives in the original signup browser — critical for
 * Gmail in-app Safari / cross-device clicks.
 */
function createSupabaseForCallback(request: NextRequest, queue: CookieChunk[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          queue.push({ name, value, options });
        });
      },
    },
  });
}

function redirectWithCookies(
  queue: CookieChunk[],
  url: string,
): NextResponse {
  const res = NextResponse.redirect(url);
  return appendCookies(res, queue);
}

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
    if (typeParam === "recovery") {
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
