"use client";

import { cn } from "@/lib/utils";

type OwnershipFilter = "all" | "my-tasks";

interface TaskOwnershipFilterProps {
  value: OwnershipFilter;
  onChange: (value: OwnershipFilter) => void;
}

export function TaskOwnershipFilter({ value, onChange }: TaskOwnershipFilterProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          value === "all"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
        )}
      >
        All Tasks
      </button>
      <button
        type="button"
        onClick={() => onChange("my-tasks")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          value === "my-tasks"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
        )}
      >
        My Tasks
      </button>
    </div>
  );
}
