"use client";

import { useEffect } from "react";

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-red-700 dark:text-red-400">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white text-sm font-medium hover:bg-red-700 transition"
      >
        Try again
      </button>
    </div>
  );
}
