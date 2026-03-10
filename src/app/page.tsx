import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold text-primary-600 mb-2">
        Construction PM
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-md">
        Manage construction projects, tasks, and teams in one place.
      </p>
      <div className="flex gap-4">
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
      </div>
    </main>
  );
}
