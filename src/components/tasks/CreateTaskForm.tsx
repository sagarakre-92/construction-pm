"use client";

import { useTransition } from "react";

type CreateTaskFormProps = {
  createTask: (formData: FormData) => Promise<{ error: string | null }>;
  onSuccess?: () => void;
};

export function CreateTaskForm({ createTask, onSuccess }: CreateTaskFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const { error } = await createTask(formData);
      if (!error) {
        (document.getElementById("create-task-form") as HTMLFormElement)?.reset();
        onSuccess?.();
      }
    });
  }

  return (
    <form
      id="create-task-form"
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="title" className="sr-only">
          Task title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Task title"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor="description" className="sr-only">
          Description (optional)
        </label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary-600 px-4 py-2 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
