"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

type SessionStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ) {
          if (!cancelled) setSessionStatus("invalid");
          return;
        }
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        setSessionStatus(session?.user ? "valid" : "invalid");
      } catch {
        if (!cancelled) setSessionStatus("invalid");
      }
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    !loading && passwordLongEnough && passwordsMatch && password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut();
      window.location.href = "/login?reset=1";
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (sessionStatus === "checking") {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-6" />
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full" />
      </div>
    );
  }

  if (sessionStatus === "invalid") {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Reset link is no longer valid
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          This reset link is invalid or has expired. Request a new one to
          continue.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-lg bg-primary-600 text-white px-4 py-2 font-medium hover:bg-primary-700 transition"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Choose a new password
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {success && (
          <div
            className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-4 py-3 text-sm"
            role="status"
          >
            Password updated. Redirecting to log in…
          </div>
        )}
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
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            New password
          </label>
          {/* TODO(orat-20g-followup): swap to <PasswordInput> from src/components/ui once orat-0y3 lands */}
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-slate-500">
            At least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Confirm new password
          </label>
          {/* TODO(orat-20g-followup): swap to <PasswordInput> from src/components/ui once orat-0y3 lands */}
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={
              confirmPassword.length > 0 && !passwordsMatch ? true : undefined
            }
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Passwords do not match.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-primary-600 text-white py-2 font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
