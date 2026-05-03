"use server";

import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email";
import type {
  Project,
  Task,
  InternalUser,
  TaskStatus,
  TaskPriority,
  SavedView,
  SavedViewFilters,
  OrganizationInvitationPreview,
} from "./types";

const VALID_PRIORITIES: ReadonlySet<TaskPriority> = new Set([
  "high",
  "medium",
  "low",
]);

function coercePriority(value: unknown): TaskPriority {
  if (typeof value === "string" && VALID_PRIORITIES.has(value as TaskPriority)) {
    return value as TaskPriority;
  }
  return "medium";
}
import {
  createProjectForOrganization,
  ensureProjectInCurrentOrg,
  ensureTaskInCurrentOrg,
  type ActionResult,
} from "./lib/org-data";

export type { ActionResult } from "./lib/org-data";

/** When env base URL is missing, invitation emails still need an absolute URL. Production canonical host. */
const FALLBACK_APP_ORIGIN = "https://alinoapp.com";

/** Resolve the public absolute base URL for invite links from env. */
function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "";
}

/** Build an invite URL from a token; absolute when an app URL is configured. */
function buildInviteUrl(token: string): string {
  const base = appBaseUrl();
  return base ? `${base}/invite/${token}` : `/invite/${token}`;
}

async function loadInviterName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fallbackEmail: string | null,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  const first = (data as { first_name?: string } | null)?.first_name?.trim() ?? "";
  const last = (data as { last_name?: string } | null)?.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return fallbackEmail?.trim() || "A teammate";
}

async function loadOrgName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
): Promise<string> {
  const { data } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name?.trim() || "your team";
}

export async function getCurrentUserOrgRole() {
  return (await import("./lib/org-data")).getCurrentUserOrgRole();
}

export async function getOrganizationMembersAndInvitations(organizationId: string) {
  return (await import("./lib/org-data")).getOrganizationMembersAndInvitations(organizationId);
}

export async function listPendingInvitations(organizationId: string) {
  return (await import("./lib/org-data")).listPendingInvitations(organizationId);
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Returns the current user's organization (single-org model). Delegates to org-data. */
export async function getCurrentOrganization() {
  return (await import("./lib/org-data")).getCurrentOrganization();
}

/** Creates a new organization and adds the current user as owner. For onboarding (user must not already belong to an org). */
export async function createOrganization(name: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { error: "Organization name is required" };

  const { data: orgId, error } = await supabase.rpc("orat_create_organization", {
    p_name: trimmed,
  });

  if (error) return { error: error.message };
  if (!orgId) return { error: "Failed to create organization" };
  return { data: { id: orgId } };
}

/** Complete onboarding: create organization and save user profile (first name, last name, role). */
export async function completeOnboarding(
  organizationName: string,
  firstName: string,
  lastName: string,
  role: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const orgRes = await createOrganization(organizationName.trim());
  if ("error" in orgRes) return orgRes;
  const orgId = orgRes.data.id;

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: session.user.id,
      first_name: (firstName ?? "").trim(),
      last_name: (lastName ?? "").trim(),
      role: (role ?? "").trim(),
      company: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) return { error: profileError.message };

  return { data: { id: orgId } };
}

// NOTE(orat-pjv): Agent D1 owns `src/lib/email/**` (sendInvitationEmail). Wire-up
// will land when that module is merged. Until then, invite creation returns the
// link to the UI which copies it to the clipboard.
// import { sendInvitationEmail } from "@/lib/email";

/** Create an organization invitation by email (org profile fields on accept come from the invite row defaults). Caller must be owner or admin. */
export async function createInvitation(
  organizationId: string,
  email: string,
): Promise<ActionResult<{ inviteLink: string; token: string }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const trimmedEmail = email.trim();

  const { data, error } = await supabase.rpc("orat_create_organization_invitation", {
    p_organization_id: organizationId,
    p_email: trimmedEmail,
    p_first_name: "",
    p_last_name: "",
    p_title: "",
  });

  if (error) return { error: error.message };

  const out = data as { error?: string; id?: string; token?: string } | null;
  if (out && typeof out === "object" && "error" in out && typeof out.error === "string") {
    return { error: out.error };
  }
  if (!out || typeof out.token !== "string" || typeof out.id !== "string") {
    return { error: "Failed to create invitation" };
  }

  const inviteLink = buildInviteUrl(out.token);

  if (process.env.NODE_ENV !== "test") {
    console.info("[Invite] Created invitation link for", trimmedEmail, ":", inviteLink);
  }

  // Email delivery is part of "create"; if it fails we roll the row back so the
  // pending list never shows an invitation that was never actually sent.
  const [organizationName, inviterName, expiresAt] = await Promise.all([
    loadOrgName(supabase, organizationId),
    loadInviterName(supabase, session.user.id, session.user.email ?? null),
    supabase
      .from("organization_invitations")
      .select("expires_at")
      .eq("id", out.id)
      .maybeSingle()
      .then(
        (r) =>
          (r.data as { expires_at?: string } | null)?.expires_at ?? undefined,
      ),
  ]);

  const absoluteInviteUrl = inviteLink.startsWith("http")
    ? inviteLink
    : `${appBaseUrl() || FALLBACK_APP_ORIGIN}${inviteLink}`;

  const sendResult = await sendInvitationEmail({
    to: trimmedEmail,
    inviteUrl: absoluteInviteUrl,
    organizationName,
    inviterName,
    expiresAt,
  });

  if (!sendResult.ok) {
    await supabase
      .from("organization_invitations")
      .delete()
      .eq("id", out.id);
    return {
      error:
        sendResult.error
          ? `Failed to send invitation email: ${sendResult.error}`
          : "Failed to send invitation email",
    };
  }

  return { data: { inviteLink, token: out.token } };
}

/**
 * Re-send the invitation email for an existing pending invitation. Caller must
 * be owner/admin of the org (RLS gates the read of organization_invitations).
 * Same token is preserved so any prior link the recipient might already have
 * keeps working; expires_at is bumped forward by 7 days so the row visibly
 * "refreshes" in the UI without needing a new column.
 */
export async function resendInvitationEmail(
  invitationId: string,
): Promise<ActionResult<{ ok: true }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data: row, error: fetchErr } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, email, role, status, token, expires_at, first_name, last_name, title",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Invitation not found" };

  const inv = row as {
    id: string;
    organization_id: string;
    email: string;
    status: string;
    token: string;
    expires_at?: string;
    first_name?: string;
  };

  if (inv.status !== "pending") {
    return { error: "Only pending invitations can be re-sent" };
  }

  const inviteLink = buildInviteUrl(inv.token);
  const absoluteInviteUrl = inviteLink.startsWith("http")
    ? inviteLink
    : `${appBaseUrl() || FALLBACK_APP_ORIGIN}${inviteLink}`;

  const [organizationName, inviterName] = await Promise.all([
    loadOrgName(supabase, inv.organization_id),
    loadInviterName(supabase, session.user.id, session.user.email ?? null),
  ]);

  const newExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const sendResult = await sendInvitationEmail({
    to: inv.email,
    inviteUrl: absoluteInviteUrl,
    organizationName,
    inviterName,
    recipientFirstName: inv.first_name?.trim() || undefined,
    expiresAt: newExpiresAt,
  });

  if (!sendResult.ok) {
    return {
      error:
        sendResult.error
          ? `Failed to send invitation email: ${sendResult.error}`
          : "Failed to send invitation email",
    };
  }

  // Refresh the expiration so the row visibly "moves" in the pending list and
  // the recipient gets a fresh 7-day window. RLS gates this update to admins.
  await supabase
    .from("organization_invitations")
    .update({ expires_at: newExpiresAt })
    .eq("id", inv.id);

  return { data: { ok: true } };
}

/**
 * Revoke a pending invitation by transitioning status='pending' → 'cancelled'.
 * After revocation the existing accept RPC will reject the token with
 * "This invitation has already been used or cancelled". Caller must be
 * owner/admin (enforced by RLS on organization_invitations).
 */
export async function revokeInvitation(
  invitationId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("organization_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId);

  if (error) return { error: error.message };
  return { data: null };
}

/**
 * Load invitation summary for the invite landing page. Does not require a session;
 * the token is the secret. Used to show organization name before sign-in / accept.
 */
export async function previewOrganizationInvitation(
  token: string,
): Promise<ActionResult<OrganizationInvitationPreview>> {
  const supabase = await createClient();
  const trimmed = token?.trim() ?? "";
  if (!trimmed) return { error: "Invalid invitation link" };

  const { data, error } = await supabase.rpc("orat_preview_organization_invitation", {
    p_token: trimmed,
  });
  if (error) return { error: error.message };

  const out = data as {
    error?: string;
    ok?: boolean;
    organization_id?: string;
    organization_name?: string;
    invited_email?: string;
    invited_role?: string;
    expires_at?: string;
    project_id?: string | null;
    project_name?: string | null;
  } | null;

  if (out && typeof out === "object" && typeof out.error === "string") {
    return { error: out.error };
  }

  if (
    out &&
    out.ok === true &&
    typeof out.organization_id === "string" &&
    typeof out.organization_name === "string" &&
    typeof out.invited_email === "string" &&
    typeof out.invited_role === "string" &&
    typeof out.expires_at === "string"
  ) {
    const projectId =
      typeof out.project_id === "string" && out.project_id.length > 0
        ? out.project_id
        : null;
    const projectName =
      typeof out.project_name === "string" && out.project_name.length > 0
        ? out.project_name
        : null;

    return {
      data: {
        organizationId: out.organization_id,
        organizationName: out.organization_name,
        invitedEmail: out.invited_email,
        invitedRole: out.invited_role,
        expiresAt: out.expires_at,
        projectId,
        projectName,
      },
    };
  }

  return { error: "Invalid invitation" };
}

/**
 * Result of accepting an invitation. For project-scoped invites, `projectId` and
 * `organizationId` are populated so the accept page can redirect the invitee
 * directly into the invited project.
 */
export type AcceptInvitationResult = {
  ok: true;
  projectId?: string;
  organizationId?: string;
};

/**
 * Accept an invitation by token. Handles BOTH org-wide and project-scoped invites:
 * tries the project-scoped RPC first; if the invitation isn't project-scoped,
 * falls back to the existing org-wide accept RPC.
 */
export async function acceptInvitation(
  token: string
): Promise<ActionResult<AcceptInvitationResult>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const trimmed = token?.trim() ?? "";
  if (!trimmed) return { error: "Invalid invitation link" };

  const { data: projData, error: projErr } = await supabase.rpc(
    "orat_accept_project_invitation",
    { p_token: trimmed }
  );

  if (!projErr) {
    const out = projData as
      | { error?: string; ok?: boolean; project_id?: string; organization_id?: string }
      | null;
    const projectScopedErr =
      out && typeof out === "object" && typeof out.error === "string"
        ? out.error
        : null;
    const isOrgWide = projectScopedErr === "Not a project-scoped invitation";
    if (!isOrgWide) {
      if (projectScopedErr) return { error: projectScopedErr };
      if (
        out &&
        out.ok === true &&
        typeof out.project_id === "string" &&
        typeof out.organization_id === "string"
      ) {
        return {
          data: {
            ok: true,
            projectId: out.project_id,
            organizationId: out.organization_id,
          },
        };
      }
    }
  }

  const { data, error } = await supabase.rpc("orat_accept_organization_invitation", {
    p_token: trimmed,
  });
  if (error) return { error: error.message };

  const out = data as { error?: string; ok?: boolean } | null;
  if (out && typeof out === "object" && typeof out.error === "string") {
    return { error: out.error };
  }
  if (out && typeof out === "object" && out.ok) return { data: { ok: true } };
  return { error: "Invalid invitation" };
}

/**
 * Create a project-scoped invitation. Caller must be org owner/admin OR a
 * project editor on the target project (enforced inside the RPC).
 */
export async function inviteToProject(
  projectId: string,
  email: string,
  firstName: string,
  lastName: string,
  title: string,
  projectRole: "editor" | "viewer"
): Promise<ActionResult<{ inviteLink: string; token: string }>> {
  const result = await (
    await import("./lib/org-data")
  ).createProjectInvitation(
    projectId,
    email,
    firstName,
    lastName,
    title,
    projectRole
  );
  if ("error" in result) return result;

  if (process.env.NODE_ENV !== "test") {
    console.info(
      "[Invite] Created project-scoped invitation for",
      email,
      ":",
      result.data.inviteLink
    );
  }

  // TODO(orat-pjv): once Agent D1 lands `@/lib/email`, replace clipboard fallback
  // with `await sendInvitationEmail({ to: email, inviteLink: result.data.inviteLink, projectName })`.

  return result;
}

/** List pending project-scoped invitations for the given project (caller must have read access via RLS). */
export async function listProjectPendingInvitations(projectId: string) {
  return (await import("./lib/org-data")).listProjectPendingInvitations(projectId);
}

/** Returns the current user's effective role on the given project (owner | admin | editor | viewer | null). */
export async function getProjectRole(userId: string, projectId: string) {
  return (await import("./lib/org-data")).getProjectRole(userId, projectId);
}

export async function ensureProfile(userId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      first_name: "",
      last_name: "",
      role: "",
      company: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { error: error.message };
  return { data: null };
}

export async function getProfiles(): Promise<ActionResult<InternalUser[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, company")
    .order("last_name");

  if (error) return { error: error.message };
  const list: InternalUser[] = (data ?? []).map((r) => ({
    id: r.id,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    role: r.role ?? "",
    company: r.company ?? "",
  }));
  return { data: list };
}

/** Fetches projects with details for a given organization. Delegates to org-data. */
export async function getProjectsForOrganization(organizationId: string) {
  return (await import("./lib/org-data")).getProjectsForOrganization(organizationId);
}

/** Fetches tasks for a project scoped by organization. Delegates to org-data. */
export async function getTasksForProject(projectId: string, organizationId: string) {
  return (await import("./lib/org-data")).getTasksForProject(projectId, organizationId);
}

/** Fetches projects for the current user's organization (single default org). Keeps UI behavior unchanged. */
export async function getProjectsWithDetails(): Promise<ActionResult<Project[]>> {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { data: [] };
  return getProjectsForOrganization(orgRes.data.id);
}

export async function createProject(
  data: Omit<Project, "id" | "createdDate" | "tasks" | "organizationId">
): Promise<ActionResult<Project>> {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { error: "No organization" };
  return createProjectForOrganization(orgRes.data.id, data);
}

export async function updateProject(project: Project): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const access = await ensureProjectInCurrentOrg(project.id);
  if ("error" in access) return access;

  const { error: projErr } = await supabase
    .from("orat_projects")
    .update({
      name: project.name,
      description: project.description ?? null,
      archived: project.archived ?? false,
    })
    .eq("id", project.id);

  if (projErr) return { error: projErr.message };

  const { data: proj } = await supabase
    .from("orat_projects")
    .select("owner_id")
    .eq("id", project.id)
    .single();
  const ownerId = proj?.owner_id;

  await supabase.from("orat_project_members").delete().eq("project_id", project.id);
  const memberIds = [...new Set([...(project.internalTeamMembers ?? []), ...(ownerId ? [ownerId] : [])])];
  if (memberIds.length > 0) {
    await supabase.from("orat_project_members").insert(
      memberIds.map((user_id) => ({ project_id: project.id, user_id }))
    );
  }

  const existingExtIds = new Set(project.externalStakeholders.map((e) => e.id));
  const { data: existing } = await supabase
    .from("orat_external_stakeholders")
    .select("id")
    .eq("project_id", project.id);
  for (const row of existing ?? []) {
    if (!existingExtIds.has(row.id)) {
      await supabase.from("orat_external_stakeholders").delete().eq("id", row.id);
    }
  }
  for (const e of project.externalStakeholders) {
    if (e.id.startsWith("ex-") || e.id.startsWith("ex-new")) {
      await supabase.from("orat_external_stakeholders").insert({
        project_id: project.id,
        first_name: e.firstName,
        last_name: e.lastName,
        role: e.role,
        company: e.company,
      });
    } else {
      await supabase
        .from("orat_external_stakeholders")
        .update({
          first_name: e.firstName,
          last_name: e.lastName,
          role: e.role,
          company: e.company,
        })
        .eq("id", e.id);
    }
  }

  return { data: null };
}

export async function archiveProject(projectId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const access = await ensureProjectInCurrentOrg(projectId);
  if ("error" in access) return access;

  const { error } = await supabase
    .from("orat_projects")
    .update({ archived: true })
    .eq("id", projectId);
  if (error) return { error: error.message };
  return { data: null };
}

async function parseAssignee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  assignedTo: string
): Promise<{ assigned_to_user_id: string | null; assigned_to_external_id: string | null }> {
  if (!assignedTo) return { assigned_to_user_id: null, assigned_to_external_id: null };
  const { data: ext } = await supabase
    .from("orat_external_stakeholders")
    .select("id")
    .eq("project_id", projectId)
    .eq("id", assignedTo)
    .maybeSingle();
  if (ext) return { assigned_to_user_id: null, assigned_to_external_id: assignedTo };
  return { assigned_to_user_id: assignedTo, assigned_to_external_id: null };
}

export async function createTask(
  projectId: string,
  data: Omit<Task, "id" | "projectId" | "projectName">
): Promise<ActionResult<Task>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const access = await ensureProjectInCurrentOrg(projectId);
  if ("error" in access) return access;

  const { data: proj, error: projErr } = await supabase
    .from("orat_projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();
  if (projErr || !proj?.organization_id) return { error: "Project not found or has no organization" };

  const { assigned_to_user_id, assigned_to_external_id } = await parseAssignee(
    supabase,
    projectId,
    data.assignedTo
  );

  const priority = coercePriority(data.priority);

  const { data: row, error } = await supabase
    .from("orat_tasks")
    .insert({
      project_id: projectId,
      organization_id: proj.organization_id,
      title: data.title,
      description: data.description ?? null,
      assigned_to_user_id: assigned_to_user_id || null,
      assigned_to_external_id: assigned_to_external_id || null,
      company: data.company ?? "",
      created_date: data.createdDate,
      start_date: data.startDate,
      original_due_date: data.originalDueDate,
      current_due_date: data.currentDueDate,
      status: data.status,
      priority,
      sort_order: 0,
      meeting_reference: data.meetingReference ?? null,
      history: data.history ?? [],
    })
    .select()
    .single();

  if (error || !row) return { error: error?.message ?? "Failed to create task" };

  const assigneeId = row.assigned_to_user_id ?? row.assigned_to_external_id ?? "";
  const task: Task = {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    assignedTo: assigneeId,
    company: row.company ?? "",
    createdDate: dateOnly(row.created_date),
    startDate: dateOnly(row.start_date),
    originalDueDate: dateOnly(row.original_due_date),
    currentDueDate: dateOnly(row.current_due_date),
    status: (row.status as TaskStatus) ?? "Not Started",
    priority: coercePriority((row as { priority?: unknown }).priority),
    sortOrder: (row as { sort_order?: number }).sort_order ?? 0,
    meetingReference: row.meeting_reference ?? undefined,
    projectId: row.project_id,
    organizationId: row.organization_id ?? undefined,
    history: (row.history as Task["history"]) ?? [],
  };
  return { data: task };
}

export async function updateTask(task: Task): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  if (!task.projectId) return { error: "Project ID required" };

  const access = await ensureProjectInCurrentOrg(task.projectId);
  if ("error" in access) return access;

  const { assigned_to_user_id, assigned_to_external_id } = await parseAssignee(
    supabase,
    task.projectId,
    task.assignedTo
  );

  const updatePayload: Record<string, unknown> = {
    title: task.title,
    description: task.description ?? null,
    assigned_to_user_id: assigned_to_user_id || null,
    assigned_to_external_id: assigned_to_external_id || null,
    company: task.company ?? "",
    start_date: task.startDate,
    current_due_date: task.currentDueDate,
    status: task.status,
    priority: coercePriority(task.priority),
    meeting_reference: task.meetingReference ?? null,
    history: task.history ?? [],
  };
  if (typeof task.sortOrder === "number") updatePayload.sort_order = task.sortOrder;

  const { error } = await supabase
    .from("orat_tasks")
    .update(updatePayload)
    .eq("id", task.id);

  if (error) return { error: error.message };
  return { data: null };
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  historyEntry: { date: string; action: string; user: string }
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const access = await ensureTaskInCurrentOrg(taskId);
  if ("error" in access) return access;

  const { data: task, error: fetchErr } = await supabase
    .from("orat_tasks")
    .select("history")
    .eq("id", taskId)
    .single();

  if (fetchErr || !task) return { error: fetchErr?.message ?? "Task not found" };

  const history = Array.isArray(task.history) ? [...task.history] : [];
  history.push(historyEntry);

  const { error } = await supabase
    .from("orat_tasks")
    .update({ status: newStatus, history })
    .eq("id", taskId);

  if (error) return { error: error.message };
  return { data: null };
}

/** Updates sort_order for multiple tasks (e.g. after reordering in a column). */
export async function reorderTasks(
  updates: { taskId: string; sortOrder: number }[]
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes?.data?.session ?? null;
    if (!session?.user) return { error: "Not authenticated" };

    if (!Array.isArray(updates) || updates.length === 0) return { data: null };

    for (const { taskId, sortOrder } of updates) {
      const access = await ensureTaskInCurrentOrg(taskId);
      if (access && typeof access === "object" && "error" in access) {
        const err = (access as { error: unknown }).error;
        return { error: typeof err === "string" ? err : "Access denied" };
      }
      const { error } = await supabase
        .from("orat_tasks")
        .update({ sort_order: Number(sortOrder) })
        .eq("id", taskId);
      if (error) return { error: error.message || "Update failed" };
    }
    return { data: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || "Failed to save order" };
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const access = await ensureTaskInCurrentOrg(taskId);
  if ("error" in access) return access;

  const { error } = await supabase.from("orat_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };
  return { data: null };
}

export async function listSavedViews(): Promise<ActionResult<SavedView[]>> {
  return (await import("./lib/org-data")).listSavedViews();
}

export async function getSavedView(
  viewId: string
): Promise<ActionResult<SavedView | null>> {
  return (await import("./lib/org-data")).getSavedView(viewId);
}

export async function createSavedView(
  name: string,
  filters: SavedViewFilters
): Promise<ActionResult<SavedView>> {
  return (await import("./lib/org-data")).createSavedView(name, filters);
}

export async function updateSavedView(
  viewId: string,
  patch: { name?: string; filters?: SavedViewFilters }
): Promise<ActionResult<null>> {
  return (await import("./lib/org-data")).updateSavedView(viewId, patch);
}

export async function deleteSavedView(
  viewId: string
): Promise<ActionResult<null>> {
  return (await import("./lib/org-data")).deleteSavedView(viewId);
}
