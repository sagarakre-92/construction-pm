"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TaskFilterValue = "all" | "my-tasks" | "internal" | "external";

interface TaskFilterDropdownProps {
  value: TaskFilterValue;
  onChange: (value: TaskFilterValue) => void;
}

const LABELS: Record<TaskFilterValue, string> = {
  all: "All Tasks",
  "my-tasks": "My Tasks",
  internal: "Internal Tasks",
  external: "External Tasks",
};

export function TaskFilterDropdown({ value, onChange }: TaskFilterDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskFilterValue)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter tasks" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{LABELS.all}</SelectItem>
        <SelectItem value="my-tasks">{LABELS["my-tasks"]}</SelectItem>
        <SelectItem value="internal">{LABELS.internal}</SelectItem>
        <SelectItem value="external">{LABELS.external}</SelectItem>
      </SelectContent>
    </Select>
  );
}
