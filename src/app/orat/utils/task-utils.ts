import type { Task, TaskStatus } from "../types";

const TODAY = new Date().toISOString().slice(0, 10);

export function isOverdue(task: Task): boolean {
  return task.currentDueDate < TODAY && task.status !== "Complete";
}

export function getEffectiveStatus(task: Task): TaskStatus {
  if (task.status === "Complete") return "Complete";
  if (task.currentDueDate < TODAY) return "Overdue";
  return task.status;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getStatusBadgeVariant(
  status: TaskStatus
): "not-started" | "in-progress" | "complete" | "overdue" | "default" {
  switch (status) {
    case "Not Started":
      return "not-started";
    case "In Progress":
      return "in-progress";
    case "Complete":
      return "complete";
    case "Overdue":
      return "overdue";
    default:
      return "default";
  }
}
