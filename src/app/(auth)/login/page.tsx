"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/email";
import { PasswordInput } from "@/components/ui/password-input";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedMessage, setVerifiedMessage] = useState(false);
  const [resetMessage, setResetMessage] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get("error");
    const verified = searchParams.get("verified");
    const reset = searchParams.get("reset");
    if (err === "auth_callback_failed") {
      setError(
        "Email confirmation failed or the link expired. If you opened it from an email app, copy the link and paste it into Safari or Chrome, or request a new link from the sign up page.",
      );
      setVerifiedMessage(false);
      setResetMessage(false);
    } else if (verified === "1") {
      setError(null);
      setVerifiedMessage(true);
      setResetMessage(false);
    } else if (reset === "1") {
      setError(null);
      setVerifiedMessage(false);
      setResetMessage(true);
    }
  }, [searchParams]);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your deployment.");
        return;
      }
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const redirectTo = searchParams.get("redirect") || "/orat";
      window.location.href = redirectTo.startsWith("/") ? redirectTo : "/orat";
      return;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Log in
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {verifiedMessage && (
          <div
            className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-4 py-3 text-sm"
            role="status"
          >
            Email verified. You can now log in.
          </div>
        )}
        {resetMessage && (
          <div
            className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-4 py-3 text-sm"
            role="status"
          >
            Password updated. Please log in.
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
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 text-white py-2 font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
