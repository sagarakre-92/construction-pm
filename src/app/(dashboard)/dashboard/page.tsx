import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Dashboard
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Overview of your construction projects and tasks.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/tasks"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-primary-500 transition"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Tasks
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create and manage your tasks
          </p>
        </Link>
      </div>
    </div>
  );
}
