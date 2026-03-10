"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { EmptyState } from "./EmptyState";
import type { Task } from "../types";
import { getEffectiveStatus, formatDate } from "../utils/task-utils";

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "#94a3b8",
  "In Progress": "#3b82f6",
  Complete: "#22c55e",
  Overdue: "#ef4444",
};

interface GanttViewProps {
  tasks: Task[];
  getAssigneeName: (id: string, company: string) => string;
  showProject?: boolean;
}

export function GanttView({
  tasks,
  getAssigneeName,
  showProject = false,
}: GanttViewProps) {
  if (tasks.length === 0) {
    return <EmptyState title="No tasks" description="Create a task to see the timeline." />;
  }

  const allDates = tasks.flatMap((t) => [t.startDate, t.currentDueDate]);
  const minDate = new Date(Math.min(...allDates.map((d) => new Date(d).getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => new Date(d).getTime())));
  const rangeDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) || 1;

  const data = tasks.map((task) => {
    const start = new Date(task.startDate).getTime();
    const end = new Date(task.currentDueDate).getTime();
    const startDay = (start - minDate.getTime()) / (24 * 60 * 60 * 1000);
    const durationDays = Math.max(0, (end - start) / (24 * 60 * 60 * 1000)) || 1;
    const status = getEffectiveStatus(task);
    return {
      ...task,
      name: task.title,
      startDay,
      durationDays,
      status,
      fill: STATUS_COLORS[status] ?? "#94a3b8",
      label: `${formatDate(task.startDate)} – ${formatDate(task.currentDueDate)}`,
    };
  });

  const tickDates: string[] = [];
  for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + Math.max(1, Math.floor(rangeDays / 10)))) {
    tickDates.push(d.toISOString().slice(0, 10));
  }

  return (
    <div className="h-[400px] w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <ResponsiveContainer width="100%" height="100%" minWidth={600}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
          <XAxis
            type="number"
            domain={[0, rangeDays]}
            tickFormatter={(d) => {
              const date = new Date(minDate);
              date.setDate(date.getDate() + d);
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            className="text-xs"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fontSize: 12 }}
            tickFormatter={(name, i) => (data[i]?.title?.slice(0, 24) ?? name) + (data[i]?.title?.length > 24 ? "…" : "")}
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow dark:border-slate-700 dark:bg-slate-800">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {getAssigneeName(p.assignedTo, p.company)} · {p.status}
                  </p>
                  <p className="text-xs text-slate-500">{p.label}</p>
                  {showProject && p.projectName && (
                    <p className="text-xs text-slate-500">Project: {p.projectName}</p>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="startDay" stackId="a" barSize={24} radius={0} fill="transparent" />
          <Bar dataKey="durationDays" stackId="a" barSize={24} radius={4}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
