"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Project,
  Task,
  InternalUser,
  TaskStatus,
} from "./types";
import {
  createProjectForOrganization,
  ensureProjectInCurrentOrg,
  ensureTaskInCurrentOrg,
  type ActionResult,
} from "./lib/org-data";

export type { ActionResult } from "./lib/org-data";

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

  const { error } = await supabase
    .from("orat_tasks")
    .update({
      title: task.title,
      description: task.description ?? null,
      assigned_to_user_id: assigned_to_user_id || null,
      assigned_to_external_id: assigned_to_external_id || null,
      company: task.company ?? "",
      start_date: task.startDate,
      current_due_date: task.currentDueDate,
      status: task.status,
      meeting_reference: task.meetingReference ?? null,
      history: task.history ?? [],
    })
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
