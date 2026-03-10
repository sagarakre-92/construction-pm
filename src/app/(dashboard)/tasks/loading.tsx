export default function TasksLoading() {
  return (
    <div>
      <div className="mb-2 h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-6 h-4 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
