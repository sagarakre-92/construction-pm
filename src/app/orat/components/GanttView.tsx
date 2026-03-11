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
  ReferenceLine,
  LabelList,
  Rectangle,
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD as local midnight to avoid timezone shifts. */
function parseLocalDate(dateStr: string): number {
  const s = dateStr.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Custom bar shape so the bar starts at startDay and has width durationDays (avoids stacking quirks). */
function GanttBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: { startDay: number; durationDays: number; fill?: string };
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const fill = payload?.fill ?? props.fill ?? "#94a3b8";
  const startDay = payload?.startDay ?? 0;
  const durationDays = Math.max(0.25, payload?.durationDays ?? 0);
  const offsetPx = durationDays > 0 ? (width * startDay) / durationDays : 0;
  return (
    <Rectangle
      x={(x ?? 0) + offsetPx}
      y={y}
      width={width}
      height={height}
      fill={fill}
      radius={4}
    />
  );
}

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

  // 14-day window: 7 days before today, 7 days after today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 7);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 7);
  windowEnd.setHours(23, 59, 59, 999);
  const minDate = windowStart;
  const windowStartTime = minDate.getTime();
  const rangeDays = 14;
  const todayDayIndex = 7;

  // Vertical day markers: one per day (0..14)
  const dayMarkerPositions = Array.from({ length: rangeDays + 1 }, (_, i) => i);
  // X-axis label positions: ~every 5 days
  const xAxisTicks = [0, 5, 10, 14];

  const data = tasks
    .map((task) => {
      const startTime = parseLocalDate(task.startDate);
      const dueTime = parseLocalDate(task.currentDueDate);
      const startDayIndex = Math.floor((startTime - windowStartTime) / MS_PER_DAY);
      const endDayIndex = Math.floor((dueTime - windowStartTime) / MS_PER_DAY);
      if (endDayIndex < 0 || startDayIndex > rangeDays) return null;
      const visibleStart = Math.max(0, startDayIndex);
      const visibleEnd = Math.min(rangeDays, endDayIndex);
      const startDay = visibleStart;
      const durationDays = Math.max(0.25, visibleEnd - visibleStart + 1);
      const status = getEffectiveStatus(task);
      return {
        ...task,
        name: task.title,
        orgLabel: task.company || "—",
        startDay,
        durationDays,
        status,
        fill: STATUS_COLORS[status] ?? "#94a3b8",
        label: `${formatDate(task.startDate)} – ${formatDate(task.currentDueDate)}`,
        ownerLabel: getAssigneeName(task.assignedTo, task.company),
      };
    })
    .filter(Boolean) as (Task & {
    name: string;
    orgLabel: string;
    startDay: number;
    durationDays: number;
    status: string;
    fill: string;
    label: string;
    ownerLabel: string;
  })[];

  data.sort((a, b) => {
    const c = (a.orgLabel || "").localeCompare(b.orgLabel || "");
    if (c !== 0) return c;
    return (a.title || "").localeCompare(b.title || "");
  });

  return (
    <div className="h-[400px] w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 0, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
          {dayMarkerPositions.map((x) => (
            <ReferenceLine
              key={x}
              x={x}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ))}
          <XAxis
            type="number"
            domain={[0, rangeDays]}
            ticks={xAxisTicks}
            tickFormatter={(d) => {
              const date = new Date(minDate);
              date.setDate(date.getDate() + Math.round(d));
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            className="text-xs"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="id"
            width={96}
            tick={{ fontSize: 11 }}
            tickFormatter={(_: string, index: number) => {
              const label = data[index]?.orgLabel ?? "";
              return label.length > 10 ? `${label.slice(0, 9)}…` : label;
            }}
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow dark:border-slate-700 dark:bg-slate-800">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {p.ownerLabel} · {p.status}
                  </p>
                  <p className="text-xs text-slate-500">{p.label}</p>
                  {showProject && p.projectName && (
                    <p className="text-xs text-slate-500">Project: {p.projectName}</p>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine
            x={todayDayIndex}
            stroke="#0f172a"
            strokeWidth={2}
            strokeDasharray="4 4"
            label={{ value: "Today", position: "top", fontSize: 10, fill: "#0f172a" }}
          />
          <Bar dataKey="durationDays" barSize={28} shape={(props) => <GanttBarShape {...props} />}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            <LabelList dataKey="title" position="insideLeft" offset={4} fontSize={11} fontWeight={500} />
            <LabelList dataKey="ownerLabel" position="insideLeft" offset={4} dy={14} fontSize={10} fill="#64748b" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
