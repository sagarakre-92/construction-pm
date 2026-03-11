"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Project,
  Task,
  InternalUser,
  ExternalStakeholder,
  TaskStatus,
} from "./types";

type ActionResult<T> = { data: T } | { error: string };

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

export async function getProjectsWithDetails(): Promise<ActionResult<Project[]>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

  const { data: projects, error: projErr } = await supabase
    .from("orat_projects")
    .select("id, name, description, created_date, archived, organization_id")
    .order("created_date", { ascending: false });

  if (projErr) return { error: projErr.message };
  if (!projects?.length) return { data: [] };

  const projectIds = projects.map((p) => p.id);

  const [membersRes, externalsRes, tasksRes] = await Promise.all([
    supabase.from("orat_project_members").select("project_id, user_id").in("project_id", projectIds),
    supabase.from("orat_external_stakeholders").select("*").in("project_id", projectIds),
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

export async function createProject(
  data: Omit<Project, "id" | "createdDate" | "tasks" | "organizationId">
): Promise<ActionResult<Project>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  // Use RPC so project + owner membership are created with definer rights (avoids RLS on insert)
  const { data: projectId, error: rpcErr } = await supabase.rpc("orat_create_project", {
    p_name: data.name,
    p_description: data.description ?? null,
  });

  if (rpcErr || !projectId) return { error: rpcErr?.message ?? "Failed to create project" };

  const memberIds = [...new Set([...(data.internalTeamMembers ?? []), userId])];
  if (memberIds.length > 1) {
    const { error: membersErr } = await supabase.from("orat_project_members").insert(
      memberIds.filter((id) => id !== userId).map((user_id) => ({ project_id: projectId, user_id }))
    );
    if (membersErr) return { error: membersErr.message };
  }

  const proj = {
    id: projectId,
    name: data.name,
    description: data.description ?? undefined,
    created_date: new Date().toISOString().slice(0, 10),
    archived: false,
  };

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
  const externalStakeholders: ExternalStakeholder[] = (extList ?? []).map((e) => ({
    id: e.id,
    firstName: e.first_name ?? "",
    lastName: e.last_name ?? "",
    role: e.role ?? "",
    company: e.company ?? "",
    projectId: e.project_id,
  }));

  const { data: projRow } = await supabase
    .from("orat_projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  return {
    data: {
      id: proj.id,
      name: proj.name,
      description: proj.description ?? undefined,
      createdDate: dateOnly(proj.created_date),
      archived: proj.archived ?? false,
      organizationId: projRow?.organization_id ?? "",
      internalTeamMembers: memberIds,
      externalStakeholders,
      tasks: [],
    },
  };
}

export async function updateProject(project: Project): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { error: "Not authenticated" };

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

  const { assigned_to_user_id, assigned_to_external_id } = await parseAssignee(
    supabase,
    projectId,
    data.assignedTo
  );

  const { data: row, error } = await supabase
    .from("orat_tasks")
    .insert({
      project_id: projectId,
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

  const { error } = await supabase.from("orat_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };
  return { data: null };
}
