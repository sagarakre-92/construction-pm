/**
 * Organization-scoped data access helpers.
 * Server-only: import createClient from @/lib/supabase/server.
 * Use these for org-aware project/task reads and project creation.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Project,
  Task,
  Organization,
  ExternalStakeholder,
  Invitation,
  ProjectMembershipRole,
  TaskStatus,
  TaskPriority,
  SavedView,
  SavedViewFilters,
} from "../types";

const VALID_PRIORITIES: ReadonlySet<TaskPriority> = new Set([
  "high",
  "medium",
  "low",
]);

/** Coerce a value from the DB into a valid TaskPriority, defaulting to 'medium'. */
function coercePriority(value: unknown): TaskPriority {
  if (typeof value === "string" && VALID_PRIORITIES.has(value as TaskPriority)) {
    return value as TaskPriority;
  }
  return "medium";
}

export type ActionResult<T> = { data: T } | { error: string };

export type CreateProjectData = Omit<
  Project,
  "id" | "createdDate" | "tasks" | "organizationId"
>;

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Ensures the given project belongs to the current user's organization.
 * Use before mutations to enforce org-scoped access. Returns { data: null } if allowed.
 */
export async function ensureProjectInCurrentOrg(
  projectId: string
): Promise<ActionResult<null>> {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { error: "No organization" };

  const supabase = await createClient();
  const { data: proj, error } = await supabase
    .from("orat_projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  if (error || !proj) return { error: "Project not found" };
  if (proj.organization_id !== orgRes.data.id) {
    return { error: "Project is not in your organization" };
  }
  return { data: null };
}

/**
 * Ensures the given task belongs to the current user's organization (via task.organization_id).
 * Use before task mutations. Returns { data: null } if allowed.
 */
export async function ensureTaskInCurrentOrg(
  taskId: string
): Promise<ActionResult<null>> {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { error: "No organization" };

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("orat_tasks")
    .select("organization_id")
    .eq("id", taskId)
    .single();

  if (error || !task?.organization_id) return { error: "Task not found" };
  if (task.organization_id !== orgRes.data.id) {
    return { error: "Task is not in your organization" };
  }
  return { data: null };
}

/** Returns the current user's organization (single-org model). */
export async function getCurrentOrganization(): Promise<
  ActionResult<Organization | null>
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data: orgId, error: rpcErr } =
    await supabase.rpc("orat_user_organization_id");
  if (rpcErr) return { error: rpcErr.message };
  if (!orgId) return { data: null };

  const { data: row, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .single();
  if (error) return { error: error.message };
  if (!row) return { data: null };

  return {
    data: {
      id: row.id,
      name: row.name ?? "",
      slug: row.slug ?? "",
    },
  };
}

/**
 * If the signed-in user has no organization but has a pending org invitation
 * matching their auth email, returns `/invite/{token}` so the app can redirect
 * them off the create-organization onboarding path.
 */
export async function getPendingOrganizationInvitePathForCurrentUser(): Promise<
  ActionResult<string | null>
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc(
    "orat_get_pending_organization_invite_token_for_user",
  );
  if (error) return { error: error.message };

  const out = data as
    | { ok?: boolean; token?: string | null; error?: string }
    | null;
  if (out && typeof out.error === "string") return { error: out.error };
  const token =
    out &&
    typeof out.token === "string" &&
    out.token.length > 0
      ? out.token
      : null;
  if (!token) return { data: null };
  return { data: `/invite/${encodeURIComponent(token)}` };
}

/** Current user's role in their organization (owner, admin, member) or null. */
export async function getCurrentUserOrgRole(): Promise<
  "owner" | "admin" | "member" | null
> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("orat_user_org_role");
  if (data === "owner" || data === "admin" || data === "member") return data;
  return null;
}

export type OrgMemberRow = {
  user_id: string;
  role: string;
  first_name: string;
  last_name: string;
};

export type OrgInvitationRow = {
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

/**
 * Pending (status = 'pending') invitations for an organization. Used by the
 * project Team view to show org-wide outstanding invitations alongside the
 * project's members. RLS restricts visibility to org members; the additional
 * write actions (resend / revoke) re-check that the caller is owner/admin.
 */
export async function listPendingInvitations(
  organizationId: string,
): Promise<ActionResult<OrgInvitationRow[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, email, role, status, created_at, expires_at, first_name, last_name, title",
    )
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const rows: OrgInvitationRow[] = (data ?? []).map(
    (i: {
      id: string;
      email: string;
      role: string;
      status: string;
      created_at: string;
      expires_at: string;
      first_name?: string;
      last_name?: string;
      title?: string;
    }) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      created_at: i.created_at,
      expires_at: i.expires_at,
      first_name: i.first_name ?? "",
      last_name: i.last_name ?? "",
      title: i.title ?? "",
    }),
  );

  return { data: rows };
}

/** Members and pending invitations for an org. Caller must be owner/admin (enforced by RLS). */
export async function getOrganizationMembersAndInvitations(
  organizationId: string
): Promise<
  ActionResult<{ members: OrgMemberRow[]; pendingInvitations: OrgInvitationRow[] }>
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId),
    supabase
      .from("organization_invitations")
      .select("id, email, role, status, created_at, expires_at, first_name, last_name, title")
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
  ]);

  if (membersRes.error) return { error: membersRes.error.message };
  if (invitesRes.error) {
    if (invitesRes.error.message?.includes("first_name") || invitesRes.error.message?.includes("column")) {
      const fallback = await supabase
        .from("organization_invitations")
        .select("id, email, role, status, created_at, expires_at")
        .eq("organization_id", organizationId)
        .eq("status", "pending");
      if (fallback.error) return { error: fallback.error.message };
      const pendingInvitations: OrgInvitationRow[] = (fallback.data ?? []).map(
        (i: { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          created_at: i.created_at,
          expires_at: i.expires_at,
          first_name: "",
          last_name: "",
          title: "",
        })
      );
      const memberRows = membersRes.data ?? [];
      const userIds = memberRows.map((m: { user_id: string }) => m.user_id);
      const profilesMap: Record<string, { first_name: string; last_name: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);
        for (const p of profiles ?? []) {
          profilesMap[p.id] = { first_name: p.first_name ?? "", last_name: p.last_name ?? "" };
        }
      }
      const members: OrgMemberRow[] = memberRows.map((m: { user_id: string; role: string }) => {
        const profile = profilesMap[m.user_id];
        return {
          user_id: m.user_id,
          role: m.role,
          first_name: profile?.first_name ?? "",
          last_name: profile?.last_name ?? "",
        };
      });
      return { data: { members, pendingInvitations } };
    }
    return { error: invitesRes.error.message };
  }

  const memberRows = membersRes.data ?? [];
  const userIds = memberRows.map((m: { user_id: string }) => m.user_id);
  const profilesMap: Record<string, { first_name: string; last_name: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profilesMap[p.id] = {
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
      };
    }
  }

  const members: OrgMemberRow[] = memberRows.map(
    (m: { user_id: string; role: string }) => {
      const profile = profilesMap[m.user_id];
      return {
        user_id: m.user_id,
        role: m.role,
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
      };
    }
  );

  const pendingInvitations: OrgInvitationRow[] = (invitesRes.data ?? []).map(
    (i: {
      id: string;
      email: string;
      role: string;
      status: string;
      created_at: string;
      expires_at: string;
      first_name?: string;
      last_name?: string;
      title?: string;
    }) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      created_at: i.created_at,
      expires_at: i.expires_at,
      first_name: i.first_name ?? "",
      last_name: i.last_name ?? "",
      title: i.title ?? "",
    })
  );

  return { data: { members, pendingInvitations } };
}

/** Fetches projects with details for a given organization. */
export async function getProjectsForOrganization(
  organizationId: string
): Promise<ActionResult<Project[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data: projects, error: projErr } = await supabase
    .from("orat_projects")
    .select("id, name, description, created_date, archived, organization_id")
    .eq("organization_id", organizationId)
    .order("created_date", { ascending: false });

  if (projErr) return { error: projErr.message };
  if (!projects?.length) return { data: [] };

  const projectIds = projects.map((p) => p.id);

  const [membersRes, externalsRes, tasksRes] = await Promise.all([
    supabase
      .from("orat_project_members")
      .select("project_id, user_id")
      .in("project_id", projectIds),
    supabase
      .from("orat_external_stakeholders")
      .select("*")
      .in("project_id", projectIds),
    supabase
      .from("orat_tasks")
      .select("*")
      .in("project_id", projectIds)
      .order("project_id")
      .order("status")
      .order("sort_order"),
  ]);

  const membersByProject = new Map<string, string[]>();
  for (const m of membersRes.data ?? []) {
    const list = membersByProject.get(m.project_id) ?? [];
    list.push(m.user_id);
    membersByProject.set(m.project_id, list);
  }

  const externalsByProject = new Map<string, ExternalStakeholder[]>();
  for (const e of externalsRes.data ?? []) {
    const list = externalsByProject.get(e.project_id) ?? [];
    list.push({
      id: e.id,
      firstName: e.first_name ?? "",
      lastName: e.last_name ?? "",
      role: e.role ?? "",
      company: e.company ?? "",
      projectId: e.project_id,
    });
    externalsByProject.set(e.project_id, list);
  }

  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasksRes.data ?? []) {
    const assigneeId =
      t.assigned_to_user_id ?? t.assigned_to_external_id ?? "";
    const list = tasksByProject.get(t.project_id) ?? [];
    const history = Array.isArray(t.history) ? t.history : [];
    list.push({
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      assignedTo: assigneeId,
      company: t.company ?? "",
      createdDate: dateOnly(t.created_date),
      startDate: dateOnly(t.start_date),
      originalDueDate: dateOnly(t.original_due_date),
      currentDueDate: dateOnly(t.current_due_date),
      status: (t.status as TaskStatus) ?? "Not Started",
      priority: coercePriority((t as { priority?: unknown }).priority),
      sortOrder: (t as { sort_order?: number }).sort_order ?? 0,
      meetingReference: t.meeting_reference ?? undefined,
      projectId: t.project_id,
      organizationId: t.organization_id ?? undefined,
      history: history as Task["history"],
    });
    tasksByProject.set(t.project_id, list);
  }

  const result: Project[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    createdDate: dateOnly(p.created_date),
    archived: p.archived ?? false,
    organizationId: p.organization_id ?? "",
    internalTeamMembers: membersByProject.get(p.id) ?? [],
    externalStakeholders: externalsByProject.get(p.id) ?? [],
    tasks: tasksByProject.get(p.id) ?? [],
  }));

  return { data: result };
}

/** Creates a project in the given organization. Validates current user's org matches. */
export async function createProjectForOrganization(
  organizationId: string,
  data: CreateProjectData
): Promise<ActionResult<Project>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data || orgRes.data.id !== organizationId) {
    return { error: "Organization mismatch or access denied" };
  }

  const { data: projectId, error: rpcErr } = await supabase.rpc(
    "orat_create_project",
    {
      p_name: data.name,
      p_description: data.description ?? null,
    }
  );

  if (rpcErr || !projectId)
    return { error: rpcErr?.message ?? "Failed to create project" };

  const memberIds = [
    ...new Set([...(data.internalTeamMembers ?? []), userId]),
  ];
  if (memberIds.length > 1) {
    const { error: membersErr } = await supabase
      .from("orat_project_members")
      .insert(
        memberIds
          .filter((id) => id !== userId)
          .map((user_id) => ({ project_id: projectId, user_id }))
      );
    if (membersErr) return { error: membersErr.message };
  }

  const externals = data.externalStakeholders ?? [];
  if (externals.length > 0) {
    await supabase.from("orat_external_stakeholders").insert(
      externals.map((e) => ({
        project_id: projectId,
        first_name: e.firstName,
        last_name: e.lastName,
        role: e.role,
        company: e.company,
      }))
    );
  }

  const { data: extList } = await supabase
    .from("orat_external_stakeholders")
    .select("id, first_name, last_name, role, company, project_id")
    .eq("project_id", projectId);
  const externalStakeholders: ExternalStakeholder[] = (extList ?? []).map(
    (e) => ({
      id: e.id,
      firstName: e.first_name ?? "",
      lastName: e.last_name ?? "",
      role: e.role ?? "",
      company: e.company ?? "",
      projectId: e.project_id,
    })
  );

  const { data: projRow } = await supabase
    .from("orat_projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  return {
    data: {
      id: projectId,
      name: data.name,
      description: data.description ?? undefined,
      createdDate: new Date().toISOString().slice(0, 10),
      archived: false,
      organizationId: projRow?.organization_id ?? organizationId,
      internalTeamMembers: memberIds,
      externalStakeholders,
      tasks: [],
    },
  };
}

/** Fetches tasks for a project, scoped by organization. */
export async function getTasksForProject(
  projectId: string,
  organizationId: string
): Promise<ActionResult<Task[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data: rows, error } = await supabase
    .from("orat_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .order("status")
    .order("sort_order");

  if (error) return { error: error.message };

  const tasks: Task[] = (rows ?? []).map((t) => {
    const assigneeId =
      t.assigned_to_user_id ?? t.assigned_to_external_id ?? "";
    const history = Array.isArray(t.history) ? t.history : [];
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      assignedTo: assigneeId,
      company: t.company ?? "",
      createdDate: dateOnly(t.created_date),
      startDate: dateOnly(t.start_date),
      originalDueDate: dateOnly(t.original_due_date),
      currentDueDate: dateOnly(t.current_due_date),
      status: (t.status as TaskStatus) ?? "Not Started",
      priority: coercePriority((t as { priority?: unknown }).priority),
      sortOrder: (t as { sort_order?: number }).sort_order ?? 0,
      meetingReference: t.meeting_reference ?? undefined,
      projectId: t.project_id,
      organizationId: t.organization_id ?? undefined,
      history: history as Task["history"],
    };
  });

  return { data: tasks };
}

type SavedViewRow = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  filters: unknown;
  created_at: string;
  updated_at: string;
};

function rowToSavedView(row: SavedViewRow): SavedView {
  const filters: SavedViewFilters =
    row.filters && typeof row.filters === "object" && !Array.isArray(row.filters)
      ? (row.filters as SavedViewFilters)
      : {};
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    name: row.name,
    filters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists saved views for the current user in their current organization.
 * Sharing happens at view-open time via getSavedView; the menu only shows the
 * caller's own list.
 */
export async function listSavedViews(): Promise<ActionResult<SavedView[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { data: [] };

  const { data, error } = await supabase
    .from("orat_saved_views")
    .select("id, organization_id, user_id, name, filters, created_at, updated_at")
    .eq("user_id", userId)
    .eq("organization_id", orgRes.data.id)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message };
  const rows = (data ?? []) as SavedViewRow[];
  return { data: rows.map(rowToSavedView) };
}

/**
 * Loads a single saved view by id. Visible to any member of the same
 * organization (RLS allows org-wide select), enabling shared links.
 */
export async function getSavedView(
  viewId: string
): Promise<ActionResult<SavedView | null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { data: null };

  const { data, error } = await supabase
    .from("orat_saved_views")
    .select("id, organization_id, user_id, name, filters, created_at, updated_at")
    .eq("id", viewId)
    .eq("organization_id", orgRes.data.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { data: null };
  return { data: rowToSavedView(data as SavedViewRow) };
}

/** Creates a saved view owned by the current user in their current organization. */
export async function createSavedView(
  name: string,
  filters: SavedViewFilters
): Promise<ActionResult<SavedView>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { error: "View name is required" };

  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) return orgRes;
  if (!orgRes.data) return { error: "No organization" };

  const { data, error } = await supabase
    .from("orat_saved_views")
    .insert({
      user_id: userId,
      organization_id: orgRes.data.id,
      name: trimmed,
      filters: filters ?? {},
    })
    .select("id, organization_id, user_id, name, filters, created_at, updated_at")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create saved view" };
  return { data: rowToSavedView(data as SavedViewRow) };
}

/**
 * Updates name and/or filters of a saved view the current user owns.
 * Belt + suspenders: this checks user_id matches before issuing the update;
 * the row-level UPDATE policy is the suspenders.
 */
export async function updateSavedView(
  viewId: string,
  patch: { name?: string; filters?: SavedViewFilters }
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const { data: existing, error: fetchErr } = await supabase
    .from("orat_saved_views")
    .select("user_id")
    .eq("id", viewId)
    .single();
  if (fetchErr || !existing) return { error: "Saved view not found" };
  if (existing.user_id !== userId) {
    return { error: "You can only update your own saved views" };
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "View name is required" };
    updatePayload.name = trimmed;
  }
  if (patch.filters !== undefined) {
    updatePayload.filters = patch.filters ?? {};
  }
  if (Object.keys(updatePayload).length === 0) return { data: null };

  const { error } = await supabase
    .from("orat_saved_views")
    .update(updatePayload)
    .eq("id", viewId);
  if (error) return { error: error.message };
  return { data: null };
}

/** Deletes a saved view the current user owns. */
export async function deleteSavedView(
  viewId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const { data: existing, error: fetchErr } = await supabase
    .from("orat_saved_views")
    .select("user_id")
    .eq("id", viewId)
    .single();
  if (fetchErr || !existing) return { error: "Saved view not found" };
  if (existing.user_id !== userId) {
    return { error: "You can only delete your own saved views" };
  }

  const { error } = await supabase
    .from("orat_saved_views")
    .delete()
    .eq("id", viewId);
  if (error) return { error: error.message };
  return { data: null };
}

// ---------------------------------------------------------------------------
// Project-scoped invitations
// ---------------------------------------------------------------------------

function buildInviteLink(token: string): string {
  let base = "";
  if (process.env.NEXT_PUBLIC_APP_URL) {
    base = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  } else if (process.env.VERCEL_URL) {
    base = `https://${process.env.VERCEL_URL}`;
  }
  return base ? `${base}/invite/${token}` : `/invite/${token}`;
}

/**
 * Creates a project-scoped invitation. The caller must be an org owner/admin
 * OR a project editor on the target project (enforced inside the RPC).
 */
export async function createProjectInvitation(
  projectId: string,
  email: string,
  firstName: string,
  lastName: string,
  title: string,
  projectRole: "editor" | "viewer",
): Promise<ActionResult<{ inviteLink: string; token: string }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const trimmedEmail = (email ?? "").trim().toLowerCase();
  if (!trimmedEmail) return { error: "Email is required" };
  if (projectRole !== "editor" && projectRole !== "viewer") {
    return { error: "Project role must be editor or viewer" };
  }

  const { data, error } = await supabase.rpc(
    "orat_create_project_invitation",
    {
      p_project_id: projectId,
      p_email: trimmedEmail,
      p_first_name: (firstName ?? "").trim(),
      p_last_name: (lastName ?? "").trim(),
      p_title: (title ?? "").trim(),
      p_project_role: projectRole,
    },
  );

  if (error) return { error: error.message };
  const out = data as { error?: string; id?: string; token?: string } | null;
  if (out && typeof out === "object" && typeof out.error === "string") {
    return { error: out.error };
  }
  if (!out || typeof out.token !== "string") {
    return { error: "Failed to create invitation" };
  }

  return { data: { inviteLink: buildInviteLink(out.token), token: out.token } };
}

/**
 * Accepts a project-scoped invitation. On success, grows orat_project_members
 * (with the invited project_role) AND, in the pragmatic path, organization_members.
 * Returns the project_id and organization_id of the accepted invite.
 */
export async function acceptProjectInvitation(
  token: string,
): Promise<ActionResult<{ projectId: string; organizationId: string }>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const trimmed = (token ?? "").trim();
  if (!trimmed) return { error: "Invalid invitation link" };

  const { data, error } = await supabase.rpc(
    "orat_accept_project_invitation",
    { p_token: trimmed },
  );

  if (error) return { error: error.message };
  const out = data as
    | { error?: string; ok?: boolean; project_id?: string; organization_id?: string }
    | null;
  if (out && typeof out === "object" && typeof out.error === "string") {
    return { error: out.error };
  }
  if (
    !out ||
    out.ok !== true ||
    typeof out.project_id !== "string" ||
    typeof out.organization_id !== "string"
  ) {
    return { error: "Invalid invitation" };
  }

  return {
    data: { projectId: out.project_id, organizationId: out.organization_id },
  };
}

/**
 * Returns pending project-scoped invitations for a project. The caller must be
 * able to read the row under RLS (org owner/admin per migration 015).
 */
export async function listProjectPendingInvitations(
  projectId: string,
): Promise<ActionResult<Invitation[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, email, role, status, created_at, expires_at, first_name, last_name, title, project_id, project_role",
    )
    .eq("project_id", projectId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    project_id?: string | null;
    project_role?: string | null;
  }>;

  const list: Invitation[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    title: r.title ?? "",
    projectId: r.project_id ?? undefined,
    projectRole:
      r.project_role === "viewer" || r.project_role === "editor"
        ? r.project_role
        : undefined,
  }));

  return { data: list };
}

/**
 * Returns the current user's effective project role. Org owner/admin is reflected
 * via 'owner' / 'admin'; otherwise returns the orat_project_members.project_role
 * ('editor' | 'viewer'), or null if the user has no access.
 *
 * The `userId` parameter is included for call-site clarity; the underlying RPC
 * always operates on `auth.uid()` for security.
 */
export async function getProjectRole(
  userId: string,
  projectId: string,
): Promise<ProjectMembershipRole | null> {
  void userId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("orat_user_project_role", {
    p_project_id: projectId,
  });
  if (error) return null;
  if (
    data === "owner" ||
    data === "admin" ||
    data === "editor" ||
    data === "viewer"
  ) {
    return data;
  }
  return null;
}
