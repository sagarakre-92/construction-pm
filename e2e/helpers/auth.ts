/**
 * Programmatic Supabase login helper for Playwright E2E tests.
 *
 * Strategy (per `.cursor/skills/write-e2e-test/SKILL.md`):
 *   1. Sign in via `@supabase/ssr`'s `createServerClient.auth.signInWithPassword`.
 *   2. Capture the auth cookies the SSR client emits via its `setAll` adapter
 *      — this gives us the exact cookie names (`sb-<project-ref>-auth-token`,
 *      plus `.0`, `.1`, … chunks when the JWT is large), encoding (`base64-`
 *      prefix), and options the running app expects.
 *   3. Forward those cookies to Playwright's `BrowserContext` so a subsequent
 *      `page.goto('/orat')` is treated as authenticated.
 *
 * Required env vars (read from `process.env`):
 *   - `NEXT_PUBLIC_SUPABASE_URL`       — Supabase project URL (local CLI or hosted)
 *   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  — anon publishable key
 *   - `TEST_USER_EMAIL`                — pre-provisioned test account email
 *   - `TEST_USER_PASSWORD`             — password for that test account
 *
 * Optional:
 *   - `PLAYWRIGHT_BASE_URL`            — overrides the default `http://localhost:3000`
 *                                        used to scope the cookie domain.
 *
 * Callers should either:
 *   - Guard with `hasTestCredentials()` and `test.skip(!hasTestCredentials(), …)`
 *     when env vars are absent, OR
 *   - Wrap `loginAs` in try/catch and check for `MissingTestCredentialsError`.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Thrown by {@link loginAs} when one or more required env vars are missing.
 * Callers can catch this (or pre-check with {@link hasTestCredentials}) to
 * `test.skip()` rather than fail the suite when running without test creds.
 */
export class MissingTestCredentialsError extends Error {
  readonly missing: readonly RequiredEnvVar[];

  constructor(missing: readonly RequiredEnvVar[]) {
    super(
      `E2E auth helper is missing required env vars: ${missing.join(", ")}. ` +
        "Set them in .env.local (or your CI secret store) before running auth-required specs.",
    );
    this.name = "MissingTestCredentialsError";
    this.missing = missing;
  }
}

/**
 * Returns true when every env var needed by {@link loginAs} is present.
 * Use this to decide whether to run or skip auth-required specs.
 */
export function hasTestCredentials(): boolean {
  return REQUIRED_ENV_VARS.every((name) => Boolean(process.env[name]));
}

export interface LoginAsOptions {
  /** Override the email read from `TEST_USER_EMAIL`. */
  email?: string;
  /** Override the password read from `TEST_USER_PASSWORD`. */
  password?: string;
  /**
   * Origin of the running app — cookies are scoped to this hostname.
   * Defaults to `process.env.PLAYWRIGHT_BASE_URL` or `http://localhost:3000`,
   * matching `playwright.config.ts`.
   */
  appUrl?: string;
}

interface ResolvedEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  password: string;
}

interface CapturedCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

function resolveEnv(): ResolvedEnv {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new MissingTestCredentialsError(missing);
  }
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    email: process.env.TEST_USER_EMAIL as string,
    password: process.env.TEST_USER_PASSWORD as string,
  };
}

type PlaywrightSameSite = "Strict" | "Lax" | "None";

function toPlaywrightSameSite(value: CookieOptions["sameSite"]): PlaywrightSameSite {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "strict") return "Strict";
    if (normalized === "none") return "None";
    if (normalized === "lax") return "Lax";
  }
  // @supabase/ssr defaults to `lax`; mirror that.
  return "Lax";
}

/**
 * Sign in as the test user via the Supabase API and seed the resulting auth
 * cookies on the given page's `BrowserContext`. After this resolves, calls to
 * `page.goto('/orat')` (or any other protected route) skip the login form.
 *
 * @throws {MissingTestCredentialsError} when required env vars are absent.
 * @throws {Error} when Supabase rejects the credentials or no auth cookies are emitted.
 */
export async function loginAs(page: Page, opts: LoginAsOptions = {}): Promise<void> {
  const env = resolveEnv();
  const email = opts.email ?? env.email;
  const password = opts.password ?? env.password;

  // Drive @supabase/ssr's storage adapter so it produces correctly-named,
  // correctly-encoded cookies — including chunked variants for long JWTs.
  const captured: CapturedCookie[] = [];
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet: CapturedCookie[]) {
        for (const cookie of cookiesToSet) {
          captured.push(cookie);
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Supabase signInWithPassword failed for ${email}: ${error.message}`);
  }

  // Keep only the latest set/remove operation per cookie name and drop any
  // explicit clears emitted as part of the sign-in dance.
  const latest = new Map<string, CapturedCookie>();
  for (const cookie of captured) {
    latest.set(cookie.name, cookie);
  }
  const authCookies = Array.from(latest.values()).filter(({ value }) => value !== "");

  if (authCookies.length === 0) {
    throw new Error(
      "Supabase signInWithPassword succeeded but emitted no auth cookies. " +
        "Check that the test user is confirmed and the project URL is reachable.",
    );
  }

  await applyCookies(page.context(), authCookies, opts.appUrl);
}

async function applyCookies(
  context: BrowserContext,
  cookies: readonly CapturedCookie[],
  appUrlOverride: string | undefined,
): Promise<void> {
  const appOrigin = new URL(
    appUrlOverride ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  );
  const isHttps = appOrigin.protocol === "https:";

  await context.addCookies(
    cookies.map(({ name, value, options }) => {
      const cookie: Parameters<BrowserContext["addCookies"]>[0][number] = {
        name,
        value,
        domain: appOrigin.hostname,
        path: typeof options.path === "string" ? options.path : "/",
        httpOnly: Boolean(options.httpOnly),
        // Honor `Secure` only when the app itself is on HTTPS — local dev is
        // plain HTTP and a `secure` cookie would be silently dropped.
        secure: isHttps && Boolean(options.secure),
        sameSite: toPlaywrightSameSite(options.sameSite),
      };

      if (typeof options.maxAge === "number") {
        cookie.expires = Math.floor(Date.now() / 1000) + options.maxAge;
      } else if (options.expires instanceof Date) {
        cookie.expires = Math.floor(options.expires.getTime() / 1000);
      }

      return cookie;
    }),
  );
}
