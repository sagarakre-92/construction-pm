import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold text-primary-600 mb-2">
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
          className="px-4 py-2 rounded-lg border border-primary-500 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition"
        >
          Sign up
        </Link>
        <Link
          href="/orat"
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        >
          Open app
        </Link>
      </div>
    </main>
  );
}
