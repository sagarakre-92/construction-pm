"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "./EmptyState";
import type { Task, TaskStatus } from "../types";
import { getEffectiveStatus, getStatusBadgeVariant, formatDate } from "../utils/task-utils";
import { cn } from "@/lib/utils";

// "Overdue" is a virtual swimlane: it is a derived view of any task whose
// effective status is Overdue, regardless of the task's stored status. Cards
// can be dragged OUT of Overdue (which sets the destination column's stored
// status); dropping ONTO Overdue is a no-op because Overdue is not a stored
// status.
const COLUMNS: { status: TaskStatus; title: string; virtual?: boolean }[] = [
  { status: "Overdue", title: "Overdue", virtual: true },
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
  onReorder?: (status: TaskStatus, orderedTaskIds: string[]) => void;
  getAssigneeName: (id: string, company: string) => string;
}

export function KanbanView({
  tasks,
  selectedTaskIds,
  onToggleSelect,
  onTaskClick,
  onStatusChange,
  onReorder,
  getAssigneeName,
}: KanbanViewProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent, task: Task) => {
      e.dataTransfer.setData("taskId", task.id);
      e.dataTransfer.setData("sourceStatus", getEffectiveStatus(task));
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDropOnColumn = useCallback(
    (e: React.DragEvent, columnStatus: TaskStatus) => {
      e.preventDefault();
      // Overdue is derived, not stored — refuse status changes onto it.
      if (columnStatus === "Overdue") return;
      const taskId = e.dataTransfer.getData("taskId");
      if (taskId) onStatusChange(taskId, columnStatus);
    },
    [onStatusChange]
  );

  const handleDropOnCard = useCallback(
    (e: React.DragEvent, columnStatus: TaskStatus, insertBeforeTask: Task, columnTasks: Task[]) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId = e.dataTransfer.getData("taskId");
      const sourceStatus = e.dataTransfer.getData("sourceStatus") as TaskStatus | "";
      if (!taskId) return;
      if (sourceStatus === columnStatus && onReorder) {
        const without = columnTasks.filter((t) => t.id !== taskId);
        const insertIdx = without.findIndex((t) => t.id === insertBeforeTask.id);
        const orderedIds =
          insertIdx < 0
            ? [...without.map((t) => t.id), taskId]
            : [
                ...without.slice(0, insertIdx).map((t) => t.id),
                taskId,
                ...without.slice(insertIdx).map((t) => t.id),
              ];
        onReorder(columnStatus, orderedIds);
      } else if (columnStatus !== "Overdue") {
        onStatusChange(taskId, columnStatus);
      }
    },
    [onReorder, onStatusChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // getEffectiveStatus returns "Overdue" for any past-due, non-complete task,
  // so filtering each column by `getEffectiveStatus(t) === col.status` is
  // enough: Overdue tasks land in the Overdue lane only and disappear from
  // Not Started / In Progress automatically.
  const tasksByColumn = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks
      .filter((t) => getEffectiveStatus(t) === col.status)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-4">
      {tasksByColumn.map(({ status, title, tasks: columnTasks, virtual }) => (
        <div
          key={status}
          data-board-column={status}
          className={cn(
            "flex min-w-[260px] flex-col shrink-0 rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30 md:min-w-0",
            virtual && status === "Overdue" && "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
          )}
          onDrop={(e) => handleDropOnColumn(e, status)}
          onDragOver={handleDragOver}
        >
          <div
            className={cn(
              "border-b border-slate-200 px-4 py-3 dark:border-slate-700",
              virtual && status === "Overdue" && "border-red-200 dark:border-red-900/40"
            )}
          >
            <h3
              className={cn(
                "font-semibold text-slate-900 dark:text-white",
                virtual && status === "Overdue" && "text-red-700 dark:text-red-400"
              )}
            >
              {title}
            </h3>
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
                    onDrop={(e) => handleDropOnCard(e, status, task, columnTasks)}
                    onDragOver={handleDragOver}
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow active:cursor-grabbing hover:shadow dark:bg-slate-800",
                      effective === "Overdue" &&
                        "border-l-4 border-red-500 border-y-red-200 border-r-red-200 dark:border-red-500 dark:border-y-red-900/50 dark:border-r-red-900/50"
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
