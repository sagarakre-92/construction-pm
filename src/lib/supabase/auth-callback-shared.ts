import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export type CookieChunk = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !EMAIL_OTP_TYPES.has(raw)) return null;
  return raw as EmailOtpType;
}

export function appendCookies(
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
 */
export function createSupabaseForCallback(
  request: NextRequest,
  queue: CookieChunk[],
) {
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

export function redirectWithCookies(
  queue: CookieChunk[],
  url: string,
): NextResponse {
  const res = NextResponse.redirect(url);
  return appendCookies(res, queue);
}
