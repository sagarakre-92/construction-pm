"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusBadgeVariant } from "../utils/task-utils";
import { cn } from "@/lib/utils";

interface DashboardMetricsProps {
  total: number;
  notStarted: number;
  inProgress: number;
  overdue: number;
  complete: number;
}

const metricConfig: { key: keyof Omit<DashboardMetricsProps, "total">; label: string; variant: ReturnType<typeof getStatusBadgeVariant> }[] = [
  { key: "notStarted", label: "Not Started", variant: "not-started" },
  { key: "inProgress", label: "In Progress", variant: "in-progress" },
  { key: "overdue", label: "Overdue", variant: "overdue" },
  { key: "complete", label: "Complete", variant: "complete" },
];

export function DashboardMetrics({
  total,
  notStarted,
  inProgress,
  overdue,
  complete,
}: DashboardMetricsProps) {
  const counts = { notStarted, inProgress, overdue, complete };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <div
        className={cn(
          "rounded-lg border bg-white p-4 dark:bg-slate-800",
          "border-slate-200 dark:border-slate-700"
        )}
      >
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{total}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Total Tasks</div>
      </div>
      {metricConfig.map(({ key, label, variant }) => (
        <div
          key={key}
          className={cn(
            "rounded-lg border bg-white p-4 dark:bg-slate-800",
            variant === "overdue" && "border-red-200 dark:border-red-900/50",
            variant === "in-progress" && "border-blue-200 dark:border-blue-900/50",
            variant === "complete" && "border-green-200 dark:border-green-900/50",
            variant === "not-started" && "border-slate-200 dark:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {counts[key]}
            </span>
            <Badge variant={variant}>{label}</Badge>
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
        </div>
      ))}
    </div>
  );
}
