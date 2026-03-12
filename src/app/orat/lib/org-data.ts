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
  TaskStatus,
} from "../types";

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
    supabase.from("orat_tasks").select("*").in("project_id", projectIds),
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
    .order("created_date", { ascending: true });

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
      meetingReference: t.meeting_reference ?? undefined,
      projectId: t.project_id,
      organizationId: t.organization_id ?? undefined,
      history: history as Task["history"],
    };
  });

  return { data: tasks };
}
