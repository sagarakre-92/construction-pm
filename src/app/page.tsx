import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
        Owner&apos;s Rep Action Tracker
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-2 text-center max-w-md">
        Track actions, projects, and teams in one place.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-500 mb-8">
        Log in or sign up to get started.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
