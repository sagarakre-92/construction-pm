"use client";

import { createTask, deleteTask, getTasks } from "@/app/(dashboard)/tasks/actions";
import type { Task } from "@/types/database";
import { useCallback, useEffect, useState } from "react";
import { CreateTaskForm } from "./CreateTaskForm";
import { TaskItem } from "./TaskItem";

export function TaskList({ initialTasks }: { initialTasks: Task[] | null }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await getTasks();
    setLoading(false);
    if (err) setError(err);
    else setTasks(data ?? []);
  }, []);

  useEffect(() => {
    if (initialTasks === null) refresh();
  }, [initialTasks, refresh]);

  if (error && tasks.length === 0) {
    return (
      <div
        className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center"
        role="alert"
      >
        <p className="font-medium text-red-800 dark:text-red-300">
          Something went wrong
        </p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white text-sm font-medium hover:bg-red-700 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateTaskForm createTask={createTask} onSuccess={refresh} />
      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Loading tasks…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No tasks yet. Add one above.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <div
              className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm"
              role="alert"
            >
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-2 underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDelete={deleteTask}
                onDeleted={refresh}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
