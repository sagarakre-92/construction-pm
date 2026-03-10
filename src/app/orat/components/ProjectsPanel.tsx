"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Project } from "../types";
import { cn } from "@/lib/utils";

interface ProjectsPanelProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
}

export function ProjectsPanel({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
}: ProjectsPanelProps) {
  const activeProjects = projects.filter((p) => !p.archived);

  return (
    <aside className="flex w-[280px] flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
          <Button size="sm" onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => onSelectProject("all-projects")}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              currentProjectId === "all-projects"
                ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            All Projects
          </button>
          {activeProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                currentProjectId === project.id
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              {project.name}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-400">
          {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}
        </div>
      </div>
    </aside>
  );
}
