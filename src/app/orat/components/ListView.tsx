"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "./EmptyState";
import { PriorityBadge } from "./PriorityBadge";
import type { Task } from "../types";
import { TASK_PRIORITY_ORDER } from "../types";
import { getEffectiveStatus, getStatusBadgeVariant, formatDate } from "../utils/task-utils";
import { groupTasksBy, type GroupBy, type TaskGroup } from "../utils/list-grouping";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey =
  | "title"
  | "assignedTo"
  | "company"
  | "startDate"
  | "dueDate"
  | "status"
  | "priority"
  | "project";

const GROUP_BY_STORAGE_KEY = "orat:list:groupBy";

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  none: "None",
  status: "Status",
  assignee: "Assignee",
  project: "Project",
  "due-bucket": "Due date",
};

const VALID_GROUP_BY: GroupBy[] = ["none", "status", "assignee", "project", "due-bucket"];

function isGroupBy(value: string | null | undefined): value is GroupBy {
  return !!value && (VALID_GROUP_BY as string[]).includes(value);
}

interface ListViewProps {
  tasks: Task[];
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  getAssigneeName: (id: string, company: string) => string;
  showProjectColumn?: boolean;
}

export function ListView({
  tasks,
  selectedTaskIds,
  onToggleSelect,
  onTaskClick,
  getAssigneeName,
  showProjectColumn = false,
}: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortAsc, setSortAsc] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Hydrate the persisted group-by choice on mount. Local-only persistence
  // (per device); collapsed-state is intentionally NOT persisted because the
  // set of group keys may change between sessions.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROUP_BY_STORAGE_KEY);
      if (isGroupBy(stored)) setGroupBy(stored);
    } catch {
      // localStorage may be unavailable (private mode, SSR, etc.) — ignore.
    }
  }, []);

  const handleGroupByChange = (next: GroupBy) => {
    setGroupBy(next);
    setCollapsedGroups(new Set());
    try {
      window.localStorage.setItem(GROUP_BY_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortTasks = useMemo(() => {
    return (list: Task[]): Task[] =>
      [...list].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "title":
            cmp = a.title.localeCompare(b.title);
            break;
          case "assignedTo":
            cmp = getAssigneeName(a.assignedTo, a.company).localeCompare(
              getAssigneeName(b.assignedTo, b.company)
            );
            break;
          case "company":
            cmp = a.company.localeCompare(b.company);
            break;
          case "startDate":
            cmp = a.startDate.localeCompare(b.startDate);
            break;
          case "dueDate":
            cmp = a.currentDueDate.localeCompare(b.currentDueDate);
            break;
          case "status":
            cmp = getEffectiveStatus(a).localeCompare(getEffectiveStatus(b));
            break;
          case "priority":
            // Lower index = higher priority. Ascending sort surfaces High first.
            cmp = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
            break;
          case "project":
            cmp = (a.projectName ?? "").localeCompare(b.projectName ?? "");
            break;
          default:
            break;
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [sortKey, sortAsc, getAssigneeName]);

  const groups: TaskGroup[] = useMemo(() => {
    const computed = groupTasksBy(tasks, groupBy, { getAssigneeName });
    return computed.map((g) => ({ ...g, tasks: sortTasks(g.tasks) }));
  }, [tasks, groupBy, getAssigneeName, sortTasks]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const Th = ({
    sortKey: key,
    children,
  }: {
    sortKey: SortKey;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  const renderHeader = () => (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        <th className="w-10 px-4 py-3 text-left"></th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="title">Task Title</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="assignedTo">Assigned To</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="company">Company</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="startDate">Start Date</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="dueDate">Due Date</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="status">Status</Th>
        </th>
        <th className="px-4 py-3 text-left">
          <Th sortKey="priority">Priority</Th>
        </th>
        {showProjectColumn && (
          <th className="px-4 py-3 text-left">
            <Th sortKey="project">Project</Th>
          </th>
        )}
      </tr>
    </thead>
  );

  const renderTaskRow = (task: Task) => {
    const effective = getEffectiveStatus(task);
    return (
      <tr
        key={task.id}
        onClick={() => onTaskClick(task)}
        className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedTaskIds.has(task.id)}
            onCheckedChange={() => onToggleSelect(task.id)}
          />
        </td>
        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
          {task.title}
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
          {getAssigneeName(task.assignedTo, task.company)}
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
          {task.company}
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
          {formatDate(task.startDate)}
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
          {formatDate(task.currentDueDate)}
        </td>
        <td className="px-4 py-3">
          <Badge variant={getStatusBadgeVariant(effective)}>{effective}</Badge>
        </td>
        <td className="px-4 py-3">
          <PriorityBadge priority={task.priority} />
        </td>
        {showProjectColumn && (
          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
            {task.projectName ?? "—"}
          </td>
        )}
      </tr>
    );
  };

  const groupBySelect = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">Group by</span>
      <Select value={groupBy} onValueChange={(v) => handleGroupByChange(v as GroupBy)}>
        <SelectTrigger className="w-[160px]" aria-label="Group by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VALID_GROUP_BY.map((g) => (
            <SelectItem key={g} value={g}>
              {GROUP_BY_LABELS[g]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-end">{groupBySelect}</div>
        <EmptyState title="No tasks" description="Create a task to get started." />
      </div>
    );
  }

  if (groupBy === "none") {
    const flat = sortTasks(tasks);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-end">{groupBySelect}</div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-sm">
            {renderHeader()}
            <tbody>{flat.map(renderTaskRow)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">{groupBySelect}</div>
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          return (
            <section
              key={group.key}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700/50"
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {group.label}{" "}
                  <span className="text-slate-500 dark:text-slate-400">
                    ({group.tasks.length})
                  </span>
                </span>
              </button>
              {!collapsed && (
                <div className={cn("overflow-x-auto")}>
                  <table className="w-full text-sm">
                    {renderHeader()}
                    <tbody>{group.tasks.map(renderTaskRow)}</tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
