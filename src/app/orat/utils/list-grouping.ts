import type { Task, TaskStatus } from "../types";
import { getEffectiveStatus } from "./task-utils";

export type DueBucket =
  | "Overdue"
  | "Due today"
  | "This week"
  | "Next week"
  | "Later";

export type GroupBy = "none" | "status" | "assignee" | "project" | "due-bucket";

export interface TaskGroup {
  /** Stable key for React lists, collapse state, and persistence. */
  key: string;
  /** Human-visible header label. */
  label: string;
  tasks: Task[];
}

export interface GroupOptions {
  today?: string;
  /** Resolves an internal user / external stakeholder id to a display name. */
  getAssigneeName?: (id: string, company: string) => string;
}

const DUE_BUCKET_ORDER: DueBucket[] = [
  "Overdue",
  "Due today",
  "This week",
  "Next week",
  "Later",
];

function daysBetween(fromIso: string, toIso: string): number {
  // Parse as UTC midnight so DST/timezone shifts can't introduce ±1 day errors.
  const from = Date.parse(fromIso + "T00:00:00Z");
  const to = Date.parse(toIso + "T00:00:00Z");
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function bucketByDueDate(task: Task, today: string): DueBucket {
  if (!task.currentDueDate) return "Later";
  if (task.currentDueDate < today && task.status !== "Complete") return "Overdue";
  if (task.currentDueDate === today) return "Due today";
  const delta = daysBetween(today, task.currentDueDate);
  if (delta >= 1 && delta <= 7) return "This week";
  if (delta >= 8 && delta <= 14) return "Next week";
  return "Later";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupByDueBucket(tasks: Task[], today: string): TaskGroup[] {
  const buckets = new Map<DueBucket, Task[]>();
  for (const task of tasks) {
    const bucket = bucketByDueDate(task, today);
    const list = buckets.get(bucket) ?? [];
    list.push(task);
    buckets.set(bucket, list);
  }
  return DUE_BUCKET_ORDER.flatMap((bucket) => {
    const list = buckets.get(bucket);
    if (!list || list.length === 0) return [];
    return [{ key: bucket, label: bucket, tasks: list }];
  });
}

const UNASSIGNED_KEY = "__unassigned__";
const NO_PROJECT_KEY = "__no_project__";

const STATUS_ORDER: TaskStatus[] = [
  "Overdue",
  "Not Started",
  "In Progress",
  "Complete",
];

function groupByAssignee(
  tasks: Task[],
  getAssigneeName: GroupOptions["getAssigneeName"]
): TaskGroup[] {
  const resolveName = getAssigneeName ?? ((id, company) => company || id);
  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of tasks) {
    const key = task.assignedTo ? task.assignedTo : UNASSIGNED_KEY;
    const label =
      key === UNASSIGNED_KEY ? "Unassigned" : resolveName(task.assignedTo, task.company);
    const entry = groups.get(key) ?? { label, tasks: [] };
    entry.tasks.push(task);
    groups.set(key, entry);
  }
  return Array.from(groups.entries())
    .map(([key, entry]) => ({ key, label: entry.label, tasks: entry.tasks }))
    .sort((a, b) => {
      if (a.key === UNASSIGNED_KEY) return 1;
      if (b.key === UNASSIGNED_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
}

function groupByProject(tasks: Task[]): TaskGroup[] {
  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of tasks) {
    const name = task.projectName?.trim();
    const key = name ? `project:${name}` : NO_PROJECT_KEY;
    const label = name ? name : "(No project)";
    const entry = groups.get(key) ?? { label, tasks: [] };
    entry.tasks.push(task);
    groups.set(key, entry);
  }
  return Array.from(groups.entries())
    .map(([key, entry]) => ({ key, label: entry.label, tasks: entry.tasks }))
    .sort((a, b) => {
      if (a.key === NO_PROJECT_KEY) return 1;
      if (b.key === NO_PROJECT_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
}

function groupByStatus(tasks: Task[], today: string): TaskGroup[] {
  const buckets = new Map<TaskStatus, Task[]>();
  for (const task of tasks) {
    const status = getEffectiveStatus(task, today);
    const list = buckets.get(status) ?? [];
    list.push(task);
    buckets.set(status, list);
  }
  return STATUS_ORDER.flatMap((status) => {
    const list = buckets.get(status);
    if (!list || list.length === 0) return [];
    return [{ key: `status:${status}`, label: status, tasks: list }];
  });
}

export function groupTasksBy(
  tasks: Task[],
  groupBy: GroupBy,
  options: GroupOptions = {}
): TaskGroup[] {
  const today = options.today ?? todayIso();
  switch (groupBy) {
    case "due-bucket":
      return groupByDueBucket(tasks, today);
    case "assignee":
      return groupByAssignee(tasks, options.getAssigneeName);
    case "project":
      return groupByProject(tasks);
    case "status":
      return groupByStatus(tasks, today);
    case "none":
    default:
      return [{ key: "all", label: "All tasks", tasks: [...tasks] }];
  }
}
