"use client";

import { Button } from "@/components/ui/button";
import type { Project, InternalUser } from "../types";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTeamViewProps {
  project: Project;
  internalUsers: InternalUser[];
  onEditProject: () => void;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ProjectTeamView({
  project,
  internalUsers,
  onEditProject,
}: ProjectTeamViewProps) {
  const internal = internalUsers.filter((u) => project.internalTeamMembers.includes(u.id));
  const external = project.externalStakeholders;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Project Team</h3>
        <Button size="sm" variant="outline" onClick={onEditProject}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Internal Team Members
          </p>
          <ul className="space-y-2">
            {internal.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-md border border-slate-100 p-2 dark:border-slate-700"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  )}
                >
                  {initials(u.firstName, u.lastName)}
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{u.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            External Stakeholders
          </p>
          <ul className="space-y-2">
            {external.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">None</p>
            ) : (
              external.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-md border border-slate-100 p-2 dark:border-slate-700"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                    {initials(e.firstName, e.lastName)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {e.firstName} {e.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {e.role} · {e.company}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
