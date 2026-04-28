"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Invitation, Project, InternalUser } from "../types";
import { Pencil, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectInviteForm } from "./ProjectInviteForm";
import {
  getCurrentUserId,
  getProjectRole,
  listProjectPendingInvitations,
} from "../actions";

interface ProjectTeamViewProps {
  project: Project;
  internalUsers: InternalUser[];
  onEditProject: () => void;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function ProjectTeamView({
  project,
  internalUsers,
  onEditProject,
}: ProjectTeamViewProps) {
  const internal = internalUsers.filter((u) => project.internalTeamMembers.includes(u.id));
  const external = project.externalStakeholders;

  const [showInvite, setShowInvite] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const [pending, setPending] = useState<Invitation[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    const res = await listProjectPendingInvitations(project.id);
    if ("error" in res) {
      setPending([]);
      setPendingError(res.error);
      return;
    }
    setPending(res.data);
    setPendingError(null);
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getCurrentUserId();
      if (!userId || cancelled) return;
      const role = await getProjectRole(userId, project.id);
      if (cancelled) return;
      setCanInvite(role === "owner" || role === "admin" || role === "editor");
      if (role === "owner" || role === "admin" || role === "editor") {
        await refreshPending();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, refreshPending]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">Project Team</h3>
        <div className="flex items-center gap-2">
          {canInvite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInvite((v) => !v)}
              aria-expanded={showInvite}
              aria-controls="project-invite-form"
            >
              <UserPlus className="h-4 w-4" />
              {showInvite ? "Close" : "Invite to project"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEditProject}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {canInvite && showInvite && (
        <div
          id="project-invite-form"
          className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
        >
          <ProjectInviteForm
            projectId={project.id}
            projectName={project.name}
            onInvited={refreshPending}
          />
        </div>
      )}

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

      {canInvite && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pending project invitations
          </p>
          {pendingError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{pendingError}</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No pending invitations.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((inv) => {
                const fullName = `${inv.firstName} ${inv.lastName}`.trim();
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 p-2 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {fullName || inv.email}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {inv.email} · {inv.projectRole === "viewer" ? "Viewer" : "Editor"} · expires {formatDate(inv.expiresAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* TODO(orat-pjv): Agent D1 surfaces the org-wide pending list elsewhere on this view.
          Once both PRs land, consider co-locating both lists here for clarity. */}
    </div>
  );
}
