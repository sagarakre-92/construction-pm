import { cn } from "@/lib/utils";
import type { TaskPriority } from "../types";
import { formatTaskPriority } from "../types";

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  high: "border-red-200 bg-red-100 text-red-800 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-300",
  medium:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-300",
  low: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      aria-label={`Priority: ${formatTaskPriority(priority)}`}
      title={`Priority: ${formatTaskPriority(priority)}`}
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
        PRIORITY_CLASSES[priority],
        className,
      )}
    >
      {formatTaskPriority(priority)}
    </span>
  );
}
