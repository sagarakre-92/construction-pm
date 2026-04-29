"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/email";
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
function isUserAlreadyExistsError(err: { code?: string; message?: string }) {
  if (err.code === "user_already_exists") return true;
  if (typeof err.message === "string" && /already.*registered/i.test(err.message)) {
    return true;
  }
  return false;
}

export default function SignUpPage() {
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

  // Submit is disabled when we know it would fail anyway (mismatch, too short,
  // or below the minimum strength). Server enforces the same rules.
  const submitDisabled =
    loading ||
    !email ||
    password.length < MIN_PASSWORD_LENGTH ||
    !strength.meetsPolicy ||
    !passwordsMatch ||
    confirmPassword.length === 0;

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
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const normalized = normalizeEmail(email);
      const { error: signUpError } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
      });
      if (signUpError) {
        // Anti-enumeration: never reveal that an account already exists.
        // Take the user to the same verify-email screen a new signup hits;
        // Supabase delivers a "you already have an account" email out of
        // band that links to log in / reset password.
        if (isUserAlreadyExistsError(signUpError)) {
          window.location.href = "/signup/verify-email";
          return;
        }
        // Other errors (network, rate limit, server) get a generic message;
        // we still log the original for dev/staging debuggability.
        console.error("signUp error", signUpError);
        setError("Something went wrong. Please try again.");
        return;
      }
      window.location.href = "/signup/verify-email";
      return;
    } catch (err) {
      console.error("signUp threw", err);
      setError("Something went wrong. Please try again.");
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
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="you@example.com"
          />
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
        <Link href="/login" className="text-primary-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
