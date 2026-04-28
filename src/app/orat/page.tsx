"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Settings, Plus, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { TaskFilterDropdown, type TaskFilterValue } from "./components/TaskFilterDropdown";
import { KanbanView } from "./components/KanbanView";
import { ListView } from "./components/ListView";
import { GanttView } from "./components/GanttView";
import { BulkActionsToolbar } from "./components/BulkActionsToolbar";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { EditProjectDialog } from "./components/EditProjectDialog";
import { ArchiveProjectDialog } from "./components/ArchiveProjectDialog";
import { TaskDialog } from "./components/TaskDialog";
import { ProjectTeamView } from "./components/ProjectTeamView";
import { EmptyState } from "./components/EmptyState";
import type { Project, Task, TaskStatus, InternalUser } from "./types";
import {
  getCurrentUserId,
  getProjectsWithDetails,
  getProfiles,
  ensureProfile,
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  archiveProject as archiveProjectAction,
  createTask as createTaskAction,
  updateTask as updateTaskAction,
  updateTaskStatus as updateTaskStatusAction,
  deleteTask as deleteTaskAction,
} from "./actions";
import { getEffectiveStatus, formatDate } from "./utils/task-utils";
import { createClient } from "@/lib/supabase/client";

function getAssigneeName(
  profiles: InternalUser[],
  projects: Project[],
  assigneeId: string,
  company: string
): string {
  const internal = profiles.find((u) => u.id === assigneeId);
  if (internal) return `${internal.firstName} ${internal.lastName}`;
  for (const p of projects) {
    const ext = p.externalStakeholders.find((e) => e.id === assigneeId);
    if (ext) return `${ext.firstName} ${ext.lastName}`;
  }
  return company || assigneeId;
}

function formatTasksForClipboard(
  tasks: Task[],
  getAssigneeNameFn: (id: string, company: string) => string
): string {
  return tasks
    .map(
      (t, i) =>
        `${i + 1}. ${t.title}${t.description ? `\n   ${t.description}` : ""}\n   Start: ${formatDate(t.startDate)}\n   Due: ${formatDate(t.currentDueDate)}\n   Assigned To: ${getAssigneeNameFn(t.assignedTo, t.company)}`
    )
    .join("\n\n");
}

export default function ORATPage() {
  // [agent-D2] BEGIN — read ?project=<id>&welcome=1 from invite redirect
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectIdFromQuery = searchParams.get("project");
  const showWelcomeFromQuery = searchParams.get("welcome") === "1";
  // [agent-D2] END

  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<InternalUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    initialProjectIdFromQuery ?? "all-projects",
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"board" | "list" | "timeline">("board");
  const [taskFilter, setTaskFilter] = useState<TaskFilterValue>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogTask, setTaskDialogTask] = useState<Task | null>(null);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const FETCH_TIMEOUT_MS = 10000;

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), FETCH_TIMEOUT_MS)
      );
      const [userIdRes, projectsRes, profilesRes] = await Promise.race([
        Promise.all([
          getCurrentUserId(),
          getProjectsWithDetails(),
          getProfiles(),
        ]),
        timeoutPromise,
      ]) as [string | null, { data: Project[] } | { error: string }, { data: InternalUser[] } | { error: string }];
      if (userIdRes) setCurrentUserId(userIdRes);
      if ("error" in projectsRes) {
        setError(projectsRes.error);
        setProjects([]);
      } else {
        setProjects(projectsRes.data);
      }
      if ("data" in profilesRes) setProfiles(profilesRes.data);
      else setProfiles([]);
      if (userIdRes && "data" in profilesRes) {
        const hasProfile = profilesRes.data.some((p) => p.id === userIdRes);
        if (!hasProfile) await ensureProfile(userIdRes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      setProjects([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Safety: force exit loading state if still loading after 12s (e.g. server actions never resolve)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading((prev) => {
        if (!prev) return prev;
        setError("Loading is taking too long. Check your connection or try again.");
        return false;
      });
    }, 12000);
    return () => clearTimeout(t);
  }, []);

  // [agent-D2] BEGIN — show welcome toast for project-scoped invitees and strip query params
  const welcomeShownRef = useRef(false);
  useEffect(() => {
    if (welcomeShownRef.current) return;
    if (!showWelcomeFromQuery || !initialProjectIdFromQuery) return;
    if (loading) return;
    const project = projects.find((p) => p.id === initialProjectIdFromQuery);
    if (!project) return;
    welcomeShownRef.current = true;
    toast.success(`Welcome to ${project.name}`);
    router.replace("/orat");
  }, [
    loading,
    projects,
    showWelcomeFromQuery,
    initialProjectIdFromQuery,
    router,
  ]);
  // [agent-D2] END

  const currentProject = useMemo(
    () =>
      currentProjectId && currentProjectId !== "all-projects"
        ? projects.find((p) => p.id === currentProjectId) ?? null
        : null,
    [projects, currentProjectId]
  );

  const displayTasks = useMemo(() => {
    let list: Task[] = [];
    if (currentProjectId === "all-projects") {
      list = projects
        .filter((p) => !p.archived)
        .flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name })));
    } else if (currentProject) {
      list = currentProject.tasks.map((t) => ({
        ...t,
        projectId: currentProject.id,
        projectName: currentProject.name,
      }));
    }
    if (taskFilter === "my-tasks" && currentUserId) {
      list = list.filter((t) => t.assignedTo === currentUserId);
    } else if (taskFilter === "internal") {
      const profileIds = new Set(profiles.map((p) => p.id));
      list = list.filter((t) => profileIds.has(t.assignedTo));
    } else if (taskFilter === "external") {
      const externalIds = new Set(
        projects.flatMap((p) => p.externalStakeholders.map((e) => e.id))
      );
      list = list.filter((t) => externalIds.has(t.assignedTo));
    }
    return list;
  }, [projects, currentProjectId, currentProject, taskFilter, currentUserId, profiles]);

  const getAssigneeNameForProject = useCallback(
    (id: string, company: string) => getAssigneeName(profiles, projects, id, company),
    [profiles, projects]
  );

  const metrics = useMemo(() => {
    const notStarted = displayTasks.filter((t) => getEffectiveStatus(t) === "Not Started").length;
    const inProgress = displayTasks.filter((t) => getEffectiveStatus(t) === "In Progress").length;
    const overdue = displayTasks.filter((t) => getEffectiveStatus(t) === "Overdue").length;
    const complete = displayTasks.filter((t) => getEffectiveStatus(t) === "Complete").length;
    return {
      total: displayTasks.length,
      notStarted,
      inProgress,
      overdue,
      complete,
    };
  }, [displayTasks]);

  const toggleTaskSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleCreateProject = useCallback(
    async (data: Omit<Project, "id" | "createdDate" | "tasks" | "organizationId">) => {
      const res = await createProjectAction(data);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Project created");
      setCurrentProjectId(res.data.id);
      setCreateProjectOpen(false);
      fetchData({ silent: true });
    },
    [fetchData]
  );

  const handleSaveProject = useCallback(
    async (project: Project) => {
      const res = await updateProjectAction(project);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Project updated");
      setEditProject(null);
      setEditProjectOpen(false);
      fetchData({ silent: true });
    },
    [fetchData]
  );

  const handleArchiveProject = useCallback(async () => {
    if (!archiveProject) return;
    const res = await archiveProjectAction(archiveProject.id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Project archived");
    setCurrentProjectId("all-projects");
    setArchiveProject(null);
    setArchiveDialogOpen(false);
    fetchData({ silent: true });
  }, [archiveProject, fetchData]);

  const handleTaskStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const historyEntry = {
        date: new Date().toISOString().slice(0, 10),
        action: `Status changed to ${newStatus}`,
        user: "Current User",
      };

      let previousStatus: TaskStatus | null = null;
      let previousHistory: Task["history"] | null = null;
      for (const p of projects) {
        const task = p.tasks.find((t) => t.id === taskId);
        if (task) {
          previousStatus = task.status as TaskStatus;
          previousHistory = [...task.history];
          break;
        }
      }
      if (previousStatus === null || previousHistory === null) return;

      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: newStatus, history: [...t.history, historyEntry] }
              : t
          ),
        }))
      );

      updateTaskStatusAction(taskId, newStatus, historyEntry).then(
        (res) => {
          if ("error" in res) {
            setProjects((prev) =>
              prev.map((p) => ({
                ...p,
                tasks: p.tasks.map((t) =>
                  t.id === taskId
                    ? { ...t, status: previousStatus!, history: previousHistory! }
                    : t
                ),
              }))
            );
            toast.error(res.error);
            return;
          }
          toast.success("Task updated");
        },
        (err) => {
          setProjects((prev) =>
            prev.map((p) => ({
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: previousStatus!, history: previousHistory! }
                  : t
              ),
            }))
          );
          toast.error(err?.message ?? "Failed to update task");
        }
      );
    },
    [projects]
  );

  const handleReorder = useCallback(
    (status: TaskStatus, orderedTaskIds: string[]) => {
      if (orderedTaskIds.length === 0) return;
      const taskToProject = new Map<string, string>();
      for (const p of projects) {
        for (const t of p.tasks) taskToProject.set(t.id, p.id);
      }
      const byProject = new Map<string, { taskId: string; sortOrder: number }[]>();
      for (const id of orderedTaskIds) {
        const projectId = taskToProject.get(id);
        if (!projectId) continue;
        const list = byProject.get(projectId) ?? [];
        list.push({ taskId: id, sortOrder: list.length });
        byProject.set(projectId, list);
      }
      const updates = Array.from(byProject.values()).flat();
      if (updates.length === 0) return;

      const previousProjects = projects;
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) => {
            const list = byProject.get(p.id);
            if (!list) return t;
            const u = list.find((x) => x.taskId === t.id);
            if (!u) return t;
            if (getEffectiveStatus(t) !== status) return t;
            return { ...t, sortOrder: u.sortOrder };
          }),
        }))
      );

      fetch("/api/orat/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setProjects(previousProjects);
            toast.error(typeof data?.error === "string" ? data.error : "Failed to save order");
            return;
          }
          if (data && typeof data.error === "string") {
            setProjects(previousProjects);
            toast.error(data.error);
            return;
          }
          toast.success("Order updated");
        })
        .catch((err: unknown) => {
          setProjects(previousProjects);
          toast.error(err instanceof Error ? err.message : "Failed to save order");
        });
    },
    [projects]
  );

  const handleSaveTask = useCallback(
    (task: Task) => {
      const taskId = task.id;
      const projectId = task.projectId;
      let previousTask: Task | null = null;
      for (const p of projects) {
        const t = p.tasks.find((x) => x.id === taskId);
        if (t) {
          previousTask = { ...t, projectId: p.id, projectName: p.name };
          break;
        }
      }
      if (!previousTask || !projectId) return;

      setTaskDialogTask(null);
      setTaskDialogOpen(false);
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId ? { ...task, projectId: p.id, projectName: p.name } : t
          ),
        }))
      );

      updateTaskAction(task).then(
        (res) => {
          if ("error" in res) {
            setProjects((prev) =>
              prev.map((p) => ({
                ...p,
                tasks: p.tasks.map((t) =>
                  t.id === taskId ? previousTask! : t
                ),
              }))
            );
            toast.error(res.error);
            return;
          }
          toast.success("Task updated");
        },
        (err) => {
          setProjects((prev) =>
            prev.map((p) => ({
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? previousTask! : t
              ),
            }))
          );
          toast.error(err?.message ?? "Failed to update task");
        }
      );
    },
    [projects]
  );

  const handleCreateTask = useCallback(
    (data: Omit<Task, "id" | "history"> & { history: Task["history"] }) => {
      if (!currentProject) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const optimisticTask: Task = {
        ...data,
        id: tempId,
        projectId: currentProject.id,
        projectName: currentProject.name,
        sortOrder: 0,
        history: data.history ?? [],
      };

      setTaskDialogOpen(false);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProject.id
            ? { ...p, tasks: [...p.tasks, optimisticTask] }
            : p
        )
      );

      createTaskAction(currentProject.id, { ...data, history: data.history ?? [] }).then(
        (res) => {
          if ("error" in res) {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === currentProject.id
                  ? { ...p, tasks: p.tasks.filter((t) => t.id !== tempId) }
                  : p
              )
            );
            toast.error(res.error);
            return;
          }
          const persisted = res.data;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    tasks: p.tasks.map((t) =>
                      t.id === tempId
                        ? { ...persisted, projectId: p.id, projectName: p.name }
                        : t
                    ),
                  }
                : p
            )
          );
          toast.success("Task created");
        },
        (err) => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === currentProject.id
                ? { ...p, tasks: p.tasks.filter((t) => t.id !== tempId) }
                : p
            )
          );
          toast.error(err?.message ?? "Failed to create task");
        }
      );
    },
    [currentProject]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const res = await deleteTaskAction(taskId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Task deleted");
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setProjects((prev) =>
        prev.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }))
      );
      fetchData({ silent: true });
    },
    [fetchData]
  );

  const handleCopyToClipboard = useCallback(() => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    const text = formatTasksForClipboard(selected, (id, company) =>
      getAssigneeNameForProject(id, company)
    );
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast.success("Tasks copied to clipboard"),
        () => {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          toast.success("Tasks copied to clipboard");
        }
      );
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Tasks copied to clipboard");
    }
  }, [displayTasks, selectedTaskIds, getAssigneeNameForProject]);

  const openEditProject = (project: Project) => {
    setEditProject(project);
    setEditProjectOpen(true);
  };

  const openArchiveConfirm = (project: Project) => {
    setArchiveProject(project);
    setArchiveDialogOpen(true);
  };

  const isAllProjects = currentProjectId === "all-projects";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button variant="outline" onClick={() => fetchData()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <ProjectsPanel
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
          setSelectedTaskIds(new Set());
        }}
        onCreateProject={() => setCreateProjectOpen(true)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open projects menu"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
                {isAllProjects ? "All Projects" : currentProject?.name ?? "—"}
              </h1>
              {!isAllProjects && currentProject?.description && (
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{currentProject.description}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isAllProjects && currentProject && (
                <>
                  <DropdownMenuItem onClick={() => openEditProject(currentProject)}>
                    Edit Project Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openArchiveConfirm(currentProject)} className="text-red-600">
                    Archive Project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/orat/organization">Organization</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const supabase = createClient();
                  supabase.auth.signOut().then(
                    () => { window.location.href = "/"; },
                    () => { window.location.href = "/"; }
                  );
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!isAllProjects && currentProject && (
            <div className="mb-6">
              <ProjectTeamView
                project={currentProject}
                internalUsers={profiles}
                onEditProject={() => openEditProject(currentProject)}
              />
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <TaskFilterDropdown value={taskFilter} onChange={setTaskFilter} />
              {!isAllProjects && currentProject && (
                <Button
                  size="sm"
                  onClick={() => {
                    setTaskDialogTask(null);
                    setTaskDialogMode("create");
                    setTaskDialogOpen(true);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Create Task</span>
                </Button>
              )}
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list" | "timeline")}>
              <TabsList className="w-full grid grid-cols-3 sm:w-auto sm:inline-flex">
                <TabsTrigger value="board" className="text-xs sm:text-sm">Board</TabsTrigger>
                <TabsTrigger value="list" className="text-xs sm:text-sm">List</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs sm:text-sm">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="mb-6">
            <DashboardMetrics {...metrics} />
          </div>

          {displayTasks.length === 0 && (taskFilter === "my-tasks" || taskFilter === "internal" || taskFilter === "external") ? (
            <EmptyState
              title={
                taskFilter === "my-tasks"
                  ? "You have no assigned tasks in this view"
                  : taskFilter === "internal"
                    ? "No internal tasks in this view"
                    : "No external tasks in this view"
              }
              description="Try a different filter or create a new task."
            />
          ) : displayTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="Create a task to get started."
            />
          ) : view === "board" ? (
            <KanbanView
              tasks={displayTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={toggleTaskSelect}
              onTaskClick={(task) => {
                setTaskDialogTask(task);
                setTaskDialogMode("edit");
                setTaskDialogOpen(true);
              }}
              onStatusChange={handleTaskStatusChange}
              onReorder={handleReorder}
              getAssigneeName={getAssigneeNameForProject}
            />
          ) : view === "list" ? (
            <ListView
              tasks={displayTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={toggleTaskSelect}
              onTaskClick={(task) => {
                setTaskDialogTask(task);
                setTaskDialogMode("edit");
                setTaskDialogOpen(true);
              }}
              getAssigneeName={getAssigneeNameForProject}
              showProjectColumn={isAllProjects}
            />
          ) : (
            <GanttView
              tasks={displayTasks}
              getAssigneeName={getAssigneeNameForProject}
              showProject={isAllProjects}
            />
          )}
        </div>
      </main>

      <BulkActionsToolbar
        selectedCount={selectedTaskIds.size}
        onCopyToClipboard={handleCopyToClipboard}
        onClearSelection={() => setSelectedTaskIds(new Set())}
      />

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        internalUsers={profiles}
        onCreate={handleCreateProject}
      />
      <EditProjectDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={editProject}
        internalUsers={profiles}
        onSave={handleSaveProject}
      />
      <ArchiveProjectDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        project={archiveProject}
        onConfirm={handleArchiveProject}
      />
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={taskDialogTask}
        project={currentProject}
        internalUsers={profiles}
        mode={taskDialogMode}
        onSave={handleSaveTask}
        onCreate={handleCreateTask}
        onDelete={handleDeleteTask}
        getAssigneeName={getAssigneeNameForProject}
      />
    </>
  );
}
