"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/email";
import { safeAppInternalPath } from "@/lib/auth/safe-app-path";
import { PasswordInput } from "@/components/ui/password-input";
import {
  MIN_PASSWORD_LENGTH,
  PasswordStrengthMeter,
  scorePassword,
} from "@/components/ui/password-strength-meter";

/**
 * Heuristic to detect Supabase's "user already registered" response without
 * leaking that fact to the UI. We treat both the modern AuthApiError code and
 * older message strings as the same signal so that we still take the user to
 * the verify-email page (and let Supabase's own duplicate-signup email steer
 * them to log in or reset).
 */
function isInviteNext(path: string | null): boolean {
  return path != null && path.startsWith("/invite/");
}

/** When signing up from an invite link, lock email to the query value if valid. */
function lockedInviteEmail(
  raw: string | null,
  nextPath: string | null,
): string | null {
  if (!isInviteNext(nextPath) || !raw?.trim()) return null;
  const n = normalizeEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)) return null;
  return n;
}

function isUserAlreadyExistsError(err: { code?: string; message?: string }) {
  if (err.code === "user_already_exists") return true;
  if (typeof err.message === "string" && /already.*registered/i.test(err.message)) {
    return true;
  }
  return false;
}

function buildVerifyEmailUrl(email: string, nextPath: string | null): string {
  const q = new URLSearchParams();
  q.set("email", email);
  if (nextPath) q.set("next", nextPath);
  const suffix = q.toString();
  return suffix ? `/signup/verify-email?${suffix}` : "/signup/verify-email";
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const nextPath = safeAppInternalPath(searchParams.get("next"));
  const lockedEmail = useMemo(
    () => lockedInviteEmail(searchParams.get("email"), nextPath),
    [searchParams, nextPath],
  );
  const loginHref =
    nextPath != null ? `/login?redirect=${encodeURIComponent(nextPath)}` : "/login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const showMismatch =
    !passwordsMatch && (confirmTouched || submitAttempted) && confirmPassword.length > 0;

  const submitDisabled =
    loading ||
    !email ||
    password.length < MIN_PASSWORD_LENGTH ||
    !strength.meetsPolicy ||
    !passwordsMatch ||
    confirmPassword.length === 0;

  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!strength.meetsPolicy) {
      setError(
        `Password is too weak. Add ${strength.missing.join(" and ")}.`,
      );
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
      const callbackUrl =
        origin ? `${origin}/auth/callback${nextQuery}` : undefined;
      const normalized = normalizeEmail(email);
      const { error: signUpError } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
      });
      if (signUpError) {
        if (isUserAlreadyExistsError(signUpError)) {
          window.location.href = buildVerifyEmailUrl(normalized, nextPath);
          return;
        }
        console.error("signUp error", signUpError);
        setError(
          signUpError.message || "Something went wrong. Please try again.",
        );
        return;
      }
      window.location.href = buildVerifyEmailUrl(normalized, nextPath);
      return;
    } catch (err) {
      console.error("signUp threw", err);
      setError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Sign up
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(lockedEmail)}
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent read-only:bg-slate-50 read-only:dark:bg-slate-900/60"
            placeholder="you@example.com"
            aria-readonly={lockedEmail ? true : undefined}
          />
          {lockedEmail ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              This address matches your invitation and cannot be changed here.
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby="password-hint password-strength"
          />
          <p id="password-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            At least {MIN_PASSWORD_LENGTH} characters
          </p>
          <PasswordStrengthMeter
            id="password-strength"
            password={password}
            className="mt-2"
          />
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Confirm password
          </label>
          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={showMismatch}
            aria-describedby={showMismatch ? "confirm-password-error" : undefined}
          />
          {showMismatch && (
            <p
              id="confirm-password-error"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
              role="alert"
            >
              Passwords do not match
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full rounded-lg bg-primary-600 text-white py-2 font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link href={loginHref} className="text-primary-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function SignUpFormFallback() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full" />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFormFallback />}>
      <SignUpForm />
    </Suspense>
  );
}
