"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { TaskOwnershipFilter } from "./components/TaskOwnershipFilter";
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
import type { Project, Task, TaskStatus } from "./types";
import { INITIAL_PROJECTS, MOCK_INTERNAL_USERS, CURRENT_USER_ID } from "./mock-data";
import { getEffectiveStatus, formatDate } from "./utils/task-utils";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

function getAssigneeName(
  projects: Project[],
  assigneeId: string,
  company: string
): string {
  const internal = MOCK_INTERNAL_USERS.find((u) => u.id === assigneeId);
  if (internal) return `${internal.firstName} ${internal.lastName}`;
  for (const p of projects) {
    const ext = p.externalStakeholders.find((e) => e.id === assigneeId);
    if (ext) return `${ext.firstName} ${ext.lastName}`;
  }
  return company || assigneeId;
}

function formatTasksForClipboard(tasks: Task[], getAssigneeName: (id: string, company: string) => string): string {
  return tasks
    .map(
      (t, i) =>
        `${i + 1}. ${t.title}${t.description ? `\n   ${t.description}` : ""}\n   Start: ${formatDate(t.startDate)}\n   Due: ${formatDate(t.currentDueDate)}\n   Assigned To: ${getAssigneeName(t.assignedTo, t.company)}`
    )
    .join("\n\n");
}

export default function ORATPage() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>("proj-1");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"board" | "list" | "timeline">("board");
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "my-tasks">("all");

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogTask, setTaskDialogTask] = useState<Task | null>(null);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");

  const currentProject = useMemo(
    () => (currentProjectId && currentProjectId !== "all-projects" ? projects.find((p) => p.id === currentProjectId) ?? null : null),
    [projects, currentProjectId]
  );

  const displayTasks = useMemo(() => {
    let list: Task[] = [];
    if (currentProjectId === "all-projects") {
      list = projects
        .filter((p) => !p.archived)
        .flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name })));
    } else if (currentProject) {
      list = currentProject.tasks.map((t) => ({ ...t, projectId: currentProject.id, projectName: currentProject.name }));
    }
    if (ownershipFilter === "my-tasks") {
      list = list.filter((t) => t.assignedTo === CURRENT_USER_ID);
    }
    return list;
  }, [projects, currentProjectId, currentProject, ownershipFilter]);

  const getAssigneeNameForProject = useCallback(
    (id: string, company: string) => getAssigneeName(projects, id, company),
    [projects]
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

  const handleCreateProject = useCallback((data: Omit<Project, "id" | "createdDate" | "tasks">) => {
    const id = `proj-${Date.now()}`;
    const createdDate = new Date().toISOString().slice(0, 10);
    const externalStakeholders = (data.externalStakeholders ?? []).map((e, i) => ({
      ...e,
      id: `ex-${id}-${i}`,
      projectId: id,
    }));
    setProjects((prev) => [...prev, { ...data, id, createdDate, tasks: [], externalStakeholders }]);
    setCurrentProjectId(id);
    toast.success("Project created");
  }, []);

  const handleSaveProject = useCallback((project: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
    setEditProject(null);
    setEditProjectOpen(false);
    toast.success("Project updated");
  }, []);

  const handleArchiveProject = useCallback(() => {
    if (!archiveProject) return;
    setProjects((prev) => prev.map((p) => (p.id === archiveProject.id ? { ...p, archived: true } : p)));
    setCurrentProjectId("all-projects");
    setArchiveProject(null);
    setArchiveDialogOpen(false);
    toast.success("Project archived");
  }, [archiveProject]);

  const handleTaskStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        tasks: p.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, history: [...t.history, { date: new Date().toISOString().slice(0, 10), action: `Status changed to ${newStatus}`, user: "Current User" }] } : t
        ),
      }))
    );
    toast.success("Task updated");
  }, []);

  const handleSaveTask = useCallback((task: Task) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === task.projectId ? { ...p, tasks: p.tasks.map((t) => (t.id === task.id ? task : t)) } : p))
    );
    setTaskDialogTask(null);
    setTaskDialogOpen(false);
    toast.success("Task updated");
  }, []);

  const handleCreateTask = useCallback(
    (data: Omit<Task, "id" | "history"> & { history: Task["history"] }) => {
      if (!currentProject) return;
      const id = `task-${Date.now()}`;
      const task: Task = { ...data, id, history: data.history };
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProject.id ? { ...p, tasks: [...p.tasks, task] } : p))
      );
      setTaskDialogOpen(false);
      toast.success("Task created");
    },
    [currentProject]
  );

  const handleDeleteTask = useCallback((taskId: string) => {
    setProjects((prev) =>
      prev.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }))
    );
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    toast.success("Task deleted");
  }, []);

  const handleCopyToClipboard = useCallback(() => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    const text = formatTasksForClipboard(selected, (id, company) => getAssigneeNameForProject(id, company));
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
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isAllProjects ? "All Projects" : currentProject?.name ?? "—"}
              </h1>
              {!isAllProjects && currentProject?.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{currentProject.description}</p>
              )}
            </div>
            {!isAllProjects && currentProject && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => openEditProject(currentProject)}>
                    Edit Project Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openArchiveConfirm(currentProject)} className="text-red-600">
                    Archive Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">Home</Button>
            </Link>
            <SignOutButton />
            {!isAllProjects && currentProject && (
              <Button size="sm" onClick={() => { setTaskDialogTask(null); setTaskDialogMode("create"); setTaskDialogOpen(true); }}>
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {!isAllProjects && currentProject && (
            <div className="mb-6">
              <ProjectTeamView
                project={currentProject}
                internalUsers={MOCK_INTERNAL_USERS}
                onEditProject={() => openEditProject(currentProject)}
              />
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <TaskOwnershipFilter value={ownershipFilter} onChange={setOwnershipFilter} />
            <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list" | "timeline")}>
              <TabsList>
                <TabsTrigger value="board">Board</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="mb-6">
            <DashboardMetrics {...metrics} />
          </div>

          {ownershipFilter === "my-tasks" && displayTasks.length === 0 ? (
            <EmptyState
              title="You have no assigned tasks in this project"
              description="Switch to 'All Tasks' to see all tasks in this project, or create a new task."
            />
          ) : view === "board" ? (
            <KanbanView
              tasks={displayTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={toggleTaskSelect}
              onTaskClick={(task) => { setTaskDialogTask(task); setTaskDialogMode("edit"); setTaskDialogOpen(true); }}
              onStatusChange={handleTaskStatusChange}
              getAssigneeName={getAssigneeNameForProject}
            />
          ) : view === "list" ? (
            <ListView
              tasks={displayTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={toggleTaskSelect}
              onTaskClick={(task) => { setTaskDialogTask(task); setTaskDialogMode("edit"); setTaskDialogOpen(true); }}
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
        internalUsers={MOCK_INTERNAL_USERS}
        onCreate={handleCreateProject}
      />
      <EditProjectDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={editProject}
        internalUsers={MOCK_INTERNAL_USERS}
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
        internalUsers={MOCK_INTERNAL_USERS}
        mode={taskDialogMode}
        onSave={handleSaveTask}
        onCreate={handleCreateTask}
        onDelete={handleDeleteTask}
        getAssigneeName={getAssigneeNameForProject}
      />
    </>
  );
}
