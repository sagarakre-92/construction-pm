"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Mail, X, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCurrentUserOrgRole,
  listPendingInvitations,
  resendInvitationEmail,
  revokeInvitation,
  getCurrentUserId,
  getProjectRole,
  listProjectPendingInvitations,
} from "@/app/orat/actions";
import type { Invitation, Project, InternalUser } from "../types";

interface ProjectTeamViewProps {
  project: Project;
  internalUsers: InternalUser[];
  onEditProject: () => void;
}

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  title: string;
};

type OrgRole = "owner" | "admin" | "member" | null;

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatSentDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function inviteeDisplayName(inv: PendingInvitation): string {
  const composed = `${inv.first_name ?? ""} ${inv.last_name ?? ""}`.trim();
  return composed || inv.email;
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
  const internal = internalUsers.filter((u) =>
    project.internalTeamMembers.includes(u.id),
  );
  const external = project.externalStakeholders;
  const memberCount = internal.length + external.length;

  const [expanded, setExpanded] = useState(false);

  // Org-wide pending invitations (Agent D1).
  const [orgPending, setOrgPending] = useState<PendingInvitation[]>([]);
  const [orgPendingLoading, setOrgPendingLoading] = useState(true);
  const [orgPendingError, setOrgPendingError] = useState<string | null>(null);
  const [role, setRole] = useState<OrgRole>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  // Project-scoped invitations (Agent D2) — list only; invite is not offered in this section.
  const [canInvite, setCanInvite] = useState(false);
  const [projectPending, setProjectPending] = useState<Invitation[]>([]);
  const [projectPendingError, setProjectPendingError] = useState<string | null>(null);

  const orgId = project.organizationId;

  const loadOrgPending = useCallback(async () => {
    if (!orgId) {
      setOrgPending([]);
      setOrgPendingLoading(false);
      return;
    }
    setOrgPendingLoading(true);
    setOrgPendingError(null);
    const res = await listPendingInvitations(orgId);
    if ("error" in res) {
      setOrgPendingError(res.error);
      setOrgPending([]);
    } else {
      setOrgPending(res.data);
    }
    setOrgPendingLoading(false);
  }, [orgId]);

  useEffect(() => {
    let active = true;
    loadOrgPending();
    getCurrentUserOrgRole().then((r) => {
      if (active) setRole(r);
    });
    return () => {
      active = false;
    };
  }, [loadOrgPending]);

  const canManage = role === "owner" || role === "admin";

  const handleResend = useCallback(
    async (inv: PendingInvitation) => {
      setBusyInviteId(inv.id);
      try {
        const res = await resendInvitationEmail(inv.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Invitation re-sent to ${inv.email}`);
        await loadOrgPending();
      } finally {
        setBusyInviteId(null);
      }
    },
    [loadOrgPending],
  );

  const handleRevoke = useCallback(
    async (inv: PendingInvitation) => {
      const ok = window.confirm(
        `Revoke the invitation for ${inv.email}? The link will stop working.`,
      );
      if (!ok) return;
      setBusyInviteId(inv.id);
      try {
        const res = await revokeInvitation(inv.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Invitation for ${inv.email} revoked`);
        setOrgPending((prev) => prev.filter((p) => p.id !== inv.id));
      } finally {
        setBusyInviteId(null);
      }
    },
    [],
  );

  const refreshProjectPending = useCallback(async () => {
    const res = await listProjectPendingInvitations(project.id);
    if ("error" in res) {
      setProjectPending([]);
      setProjectPendingError(res.error);
      return;
    }
    setProjectPending(res.data);
    setProjectPendingError(null);
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getCurrentUserId();
      if (!userId || cancelled) return;
      const projectRole = await getProjectRole(userId, project.id);
      if (cancelled) return;
      const allowed =
        projectRole === "owner" ||
        projectRole === "admin" ||
        projectRole === "editor";
      setCanInvite(allowed);
      if (allowed) {
        await refreshProjectPending();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, refreshProjectPending]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary-500 dark:ring-offset-slate-800"
          aria-expanded={expanded}
          aria-controls="project-team-details"
          id="project-team-disclosure"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-600 transition-transform dark:text-slate-300",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
          <span className="font-semibold text-slate-900 dark:text-white">Project Team</span>
          <Badge
            variant="default"
            className="shrink-0 tabular-nums"
            aria-label={`${memberCount} project ${memberCount === 1 ? "member" : "members"}`}
          >
            {memberCount}
          </Badge>
        </button>
        <Button size="sm" variant="outline" onClick={onEditProject} className="shrink-0">
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {expanded && (
        <div id="project-team-details" className="mt-4 space-y-6" role="region" aria-labelledby="project-team-disclosure">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Internal Team Members
              </p>
              {internal.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">None.</p>
              ) : (
                <ul className="space-y-2">
                  {internal.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 rounded-md border border-slate-100 p-2 dark:border-slate-700"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-300",
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
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                External Stakeholders
              </p>
              {external.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">None.</p>
              ) : (
                <ul className="space-y-2">
                  {external.map((e) => (
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
                  ))}
                </ul>
              )}
            </div>
          </div>

          {canInvite && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pending project invitations
              </p>
              {projectPendingError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{projectPendingError}</p>
              ) : projectPending.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No pending invitations.</p>
              ) : (
                <ul className="space-y-2">
                  {projectPending.map((inv) => {
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
                            {inv.email} · {inv.projectRole === "viewer" ? "Viewer" : "Editor"} · expires{" "}
                            {formatDate(inv.expiresAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pending organization invitations
            </p>
            {orgPendingLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : orgPendingError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{orgPendingError}</p>
            ) : orgPending.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No pending invitations.</p>
            ) : (
              <ul className="space-y-2">
                {orgPending.map((inv) => {
                  const busy = busyInviteId === inv.id;
                  return (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-2 dark:border-slate-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {inviteeDisplayName(inv)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {inv.email} · {inv.role} · sent {formatSentDate(inv.created_at)}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleResend(inv)}
                            aria-label={`Resend invitation to ${inv.email}`}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            Resend
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => handleRevoke(inv)}
                            aria-label={`Revoke invitation for ${inv.email}`}
                          >
                            <X className="h-4 w-4" />
                            Revoke
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
