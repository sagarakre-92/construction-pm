import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xl font-semibold text-primary-600 hover:text-primary-700"
          >
            Construction PM
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/dashboard"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/tasks"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Tasks
            </Link>
            {/* TODO: Add sign out when Supabase auth is wired */}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
