"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "./EmptyState";
import { PriorityBadge } from "./PriorityBadge";
import type { Task } from "../types";
import { TASK_PRIORITY_ORDER } from "../types";
import { getEffectiveStatus, getStatusBadgeVariant, formatDate } from "../utils/task-utils";
import { ArrowUpDown } from "lucide-react";

type SortKey =
  | "title"
  | "assignedTo"
  | "company"
  | "startDate"
  | "dueDate"
  | "status"
  | "priority"
  | "project";

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
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

  if (tasks.length === 0) {
    return <EmptyState title="No tasks" description="Create a task to get started." />;
  }

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

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-sm">
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
        <tbody>
          {sortedTasks.map((task) => {
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
          })}
        </tbody>
      </table>
    </div>
  );
}
