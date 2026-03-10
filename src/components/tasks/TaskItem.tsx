"use client";

import { useTransition } from "react";
import type { Task } from "@/types/database";

type TaskItemProps = {
  task: Task;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onDeleted?: () => void;
};

export function TaskItem({ task, onDelete, onDeleted }: TaskItemProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const { error } = await onDelete(task.id);
      if (!error) onDeleted?.();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 dark:text-white truncate">
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">
            {task.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="shrink-0 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
        aria-label={`Delete task: ${task.title}`}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
    </li>
  );
}
