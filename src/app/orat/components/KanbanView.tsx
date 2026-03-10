"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "./EmptyState";
import type { Task, TaskStatus } from "../types";
import { getEffectiveStatus, getStatusBadgeVariant, formatDate } from "../utils/task-utils";
import { cn } from "@/lib/utils";

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "Not Started", title: "Not Started" },
  { status: "In Progress", title: "In Progress" },
  { status: "Complete", title: "Complete" },
];

interface KanbanViewProps {
  tasks: Task[];
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  getAssigneeName: (id: string, company: string) => string;
}

export function KanbanView({
  tasks,
  selectedTaskIds,
  onToggleSelect,
  onTaskClick,
  onStatusChange,
  getAssigneeName,
}: KanbanViewProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent, task: Task) => {
      e.dataTransfer.setData("taskId", task.id);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, columnStatus: TaskStatus) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("taskId");
      if (taskId) onStatusChange(taskId, columnStatus);
    },
    [onStatusChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const tasksByColumn = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => getEffectiveStatus(t) === col.status),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {tasksByColumn.map(({ status, title, tasks: columnTasks }) => (
        <div
          key={status}
          className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30"
          onDrop={(e) => handleDrop(e, status)}
          onDragOver={handleDragOver}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {columnTasks.length} task{columnTasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex min-h-[200px] flex-col gap-2 p-4">
            {columnTasks.length === 0 ? (
              <EmptyState title="No tasks" className="min-h-[120px]" />
            ) : (
              columnTasks.map((task) => {
                const effective = getEffectiveStatus(task);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow active:cursor-grabbing hover:shadow dark:bg-slate-800",
                      effective === "Overdue" && "border-red-200 dark:border-red-900/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedTaskIds.has(task.id)}
                        onCheckedChange={() => onToggleSelect(task.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {getAssigneeName(task.assignedTo, task.company)} · {task.company}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Due {formatDate(task.currentDueDate)}
                        </p>
                        <div className="mt-2">
                          <Badge variant={getStatusBadgeVariant(effective)}>
                            {effective}
                          </Badge>
                          {task.projectName && (
                            <span className="ml-2 text-xs text-slate-500">
                              {task.projectName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
