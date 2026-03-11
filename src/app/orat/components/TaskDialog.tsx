"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskStatus, Project, InternalUser } from "../types";
import { formatDate } from "../utils/task-utils";
import { Trash2 } from "lucide-react";

const STATUS_OPTIONS: TaskStatus[] = ["Not Started", "In Progress", "Complete", "Overdue"];

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  project: Project | null;
  internalUsers: InternalUser[];
  mode: "create" | "edit";
  onSave: (task: Task) => void;
  onCreate?: (task: Omit<Task, "id">) => void;
  onDelete?: (taskId: string) => void;
  /** Used by parent for clipboard copy; kept in props for API consistency */
  getAssigneeName: (id: string, company: string) => string;
}

function getAssigneeOptions(project: Project | null, internalUsers: InternalUser[]) {
  const internals = internalUsers
    .filter((u) => project?.internalTeamMembers.includes(u.id))
    .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}`, company: u.company }));
  const externals = (project?.externalStakeholders ?? []).map((e) => ({
    id: e.id,
    label: `${e.firstName} ${e.lastName}`,
    company: e.company,
  }));
  return [...internals, ...externals];
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  project,
  internalUsers,
  mode,
  onSave,
  onCreate,
  onDelete,
  getAssigneeName,
}: TaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Not Started");
  const [meetingReference, setMeetingReference] = useState("");

  const options = getAssigneeOptions(project, internalUsers);

  // Sync form only when dialog opens or task/mode changes. Intentionally omit project/internalUsers so we don't re-run on parent re-render and reset the form while the user is typing.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignedTo(task.assignedTo);
      setCompany(task.company);
      setStartDate(task.startDate);
      setDueDate(task.currentDueDate);
      setStatus(task.status);
      setMeetingReference(task.meetingReference ?? "");
    } else if (mode === "create") {
      const today = new Date().toISOString().slice(0, 10);
      const assigneeOptions = getAssigneeOptions(project, internalUsers);
      const first = assigneeOptions[0];
      setTitle("");
      setDescription("");
      setAssignedTo(first?.id ?? "");
      setCompany(first?.company ?? "");
      setStartDate(today);
      setDueDate(today);
      setStatus("Not Started");
      setMeetingReference("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when open/task/mode change; including project/internalUsers would reset form on every keystroke
  }, [open, task, mode]);

  useEffect(() => {
    const opt = options.find((o) => o.id === assignedTo);
    if (opt) setCompany(opt.company);
  }, [assignedTo, options]);

  const handleSave = () => {
    if (!project) return;
    const now = new Date().toISOString().slice(0, 10);
    if (mode === "edit" && task) {
      onSave({
        ...task,
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo,
        company,
        startDate,
        currentDueDate: dueDate,
        originalDueDate: task.originalDueDate,
        status,
        meetingReference: meetingReference.trim() || undefined,
        history: [
          ...task.history,
          { date: now, action: "Task updated", user: "Current User" },
        ],
      });
    } else if (mode === "create" && onCreate) {
      onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo,
        company,
        createdDate: now,
        startDate,
        originalDueDate: dueDate,
        currentDueDate: dueDate,
        status,
        meetingReference: meetingReference.trim() || undefined,
        projectId: project.id,
        projectName: project.name,
        history: [{ date: now, action: "Task created", user: "Current User" }],
      });
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (task && onDelete) {
      onDelete(task.id);
      onOpenChange(false);
    }
  };

  const valid = title.trim().length > 0 && assignedTo && startDate && dueDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Task" : "Edit Task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title (required)</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Assigned To</Label>
            {assignedTo && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current: {getAssigneeName(assignedTo, company)}
              </p>
            )}
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label} ({o.company})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-start">Start Date</Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-meeting">Meeting Reference</Label>
            <Input
              id="task-meeting"
              value={meetingReference}
              onChange={(e) => setMeetingReference(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {mode === "edit" && task && task.history.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label>History</Label>
              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {task.history.map((h, i) => (
                  <li key={i}>
                    {formatDate(h.date)} – {h.action} – {h.user}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          {mode === "edit" && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
