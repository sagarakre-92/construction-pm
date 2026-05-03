"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAppInternalPath } from "@/lib/auth/safe-app-path";
import { cn } from "@/lib/utils";

const COOLDOWN_SECONDS = 60;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const nextPath = safeAppInternalPath(searchParams.get("next"));
  const loginHref =
    nextPath != null ? `/login?redirect=${encodeURIComponent(nextPath)}` : "/login";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const [cooldownDeadline, setCooldownDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (cooldownDeadline === null) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((cooldownDeadline - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setCooldownDeadline(null);
      }
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [cooldownDeadline]);

  const isCoolingDown = secondsLeft > 0;
  const submitDisabled = loading || isCoolingDown;

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    setErrorMessage(null);
    setAlreadyVerified(false);

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setValidationError(
        "Please enter the email address you signed up with.",
      );
      return;
    }

    setLoading(true);
    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        setErrorMessage(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your deployment.",
        );
        return;
      }
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
      const callbackUrl = origin ? `${origin}/auth/callback${nextQuery}` : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalized,
        options: callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
      });
      if (error) {
        if (/already (confirmed|verified|signed up|registered)/i.test(error.message)) {
          setAlreadyVerified(true);
        } else if (/rate limit|too many|wait|seconds/i.test(error.message)) {
          // Server told us we're being throttled — mirror it in the UI so
          // the user sees a countdown instead of a raw error.
          setErrorMessage(
            "Please wait a moment before requesting another email.",
          );
          setCooldownDeadline(Date.now() + COOLDOWN_SECONDS * 1000);
        } else {
          setErrorMessage(error.message);
        }
        return;
      }
      setResentTo(normalized);
      setCooldownDeadline(Date.now() + COOLDOWN_SECONDS * 1000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 text-center">
        Please verify your email
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">
        We&apos;ve sent a confirmation link to your email address. Click the
        link to verify your account, then you can log in.
      </p>

      {alreadyVerified && (
        <div
          className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-4 py-3 text-sm"
          role="status"
        >
          This email is already verified.{" "}
          <Link
            href={loginHref}
            className="font-medium underline hover:no-underline"
          >
            Log in
          </Link>
          .
        </div>
      )}

      {resentTo && !alreadyVerified && (
        <div
          className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-4 py-3 text-sm"
          role="status"
        >
          We sent a new verification email to {resentTo}.
        </div>
      )}

      {errorMessage && (
        <div
          className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 text-sm"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleResend} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="resend-email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Email
          </label>
          <input
            id="resend-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            aria-invalid={validationError ? true : undefined}
            aria-describedby={
              validationError ? "resend-email-error" : undefined
            }
          />
          {validationError && (
            <p
              id="resend-email-error"
              role="alert"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {validationError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitDisabled}
          className={cn(
            "w-full rounded-lg bg-primary-600 text-white py-2 font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition",
          )}
        >
          {loading
            ? "Sending…"
            : isCoolingDown
              ? `Wait ${secondsLeft}s before resending`
              : "Resend verification email"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        <Link href={loginHref} className="text-primary-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto mb-4" />
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mx-auto mb-6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
