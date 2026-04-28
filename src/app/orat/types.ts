export type TaskStatus = "Not Started" | "In Progress" | "Complete" | "Overdue";

export type TaskPriority = "high" | "medium" | "low";

/** Stable ordering for sorting (lower index = higher priority). */
export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** UI options for the priority Select. Order matches the dropdown order. */
export const taskPriorityOptions: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/** Display label for a stored priority value (title-cased). */
export function formatTaskPriority(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type InternalUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
};

export type ExternalStakeholder = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  projectId: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  company: string;
  createdDate: string;
  startDate: string;
  originalDueDate: string;
  currentDueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  sortOrder?: number;
  meetingReference?: string;
  projectName?: string;
  projectId?: string;
  organizationId?: string;
  history: {
    date: string;
    action: string;
    user: string;
  }[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdDate: string;
  archived?: boolean;
  organizationId: string;
  internalTeamMembers: string[];
  externalStakeholders: ExternalStakeholder[];
  tasks: Task[];
};

export interface SavedViewFilters {
  projectId?: string | null;
  assigneeFilter?: "all" | "my-tasks" | "internal" | "external";
  viewMode?: "board" | "list" | "gantt";
  groupBy?: "none" | "status" | "assignee" | "project" | "due-bucket";
  status?: string | null;
  priority?: string | null;
  dueBucket?: string | null;
  [key: string]: unknown;
}

export interface SavedView {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  filters: SavedViewFilters;
  createdAt: string;
  updatedAt: string;
}
