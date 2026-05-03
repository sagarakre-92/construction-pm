import type { Task, TaskStatus } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(task: Task, today: string = todayIso()): boolean {
  return task.currentDueDate < today && task.status !== "Complete";
}

/**
 * Kanban columns follow stored workflow status only (no overdue swimlane).
 * Legacy stored status "Overdue" is shown in the In Progress column.
 */
export function getKanbanColumnStatus(
  task: Task
): "Not Started" | "In Progress" | "Complete" {
  if (task.status === "Complete") return "Complete";
  if (task.status === "Overdue") return "In Progress";
  return task.status;
}

export function getEffectiveStatus(
  task: Task,
  today: string = todayIso()
): TaskStatus {
  if (task.status === "Complete") return "Complete";
  if (task.currentDueDate < today) return "Overdue";
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
