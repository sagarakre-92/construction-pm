"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/orat/actions";

export function OnboardingForm() {
  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await completeOnboarding(
        organizationName,
        firstName,
        lastName,
        role
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.replace("/orat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm max-w-md w-full">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Set up your organization
      </h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
        Create your organization and add your profile details to get started.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            htmlFor="org-name"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
            placeholder="e.g. Acme Inc"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="first-name"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            First name
          </label>
          <input
            id="first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="e.g. Jane"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="last-name"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Last name
          </label>
          <input
            id="last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="e.g. Smith"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="role"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Role
          </label>
          <input
            id="role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Project Manager"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 text-white py-2 font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Completing…" : "Complete setup"}
        </button>
      </form>
    </div>
  );
}
